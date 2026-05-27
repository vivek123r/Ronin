"""
PATCHES for multi_agent_search.py
──────────────────────────────────
Changes:
  1. Remove Tavily; search_agent uses Amazon bestsellers / search directly.
  2. react_loop no longer calls Tavily — the search_agent no longer uses react_loop at all.
  3. human_loop_node validates user-added products via Amazon search before adding them.

Only the three functions below need to change. Everything else stays the same.
"""

# ─────────────────────────────────────────────────────────────────────────────
# 1.  REMOVE these two lines from the top of your file:
#
#     from langchain_community.tools.tavily_search import TavilySearchResults
#     search_tool = TavilySearchResults(max_results=5)
#
# Also remove the "search" action branch inside react_loop:
#
#     elif action == "search":
#         raw = search_tool.invoke(step_result.get("action_input", state["query"]))
#         observation = str(raw[:3])
#
# (react_loop is now only used by review_agent for its "analyze" / "done" actions,
#  so the search branch is dead code anyway.)
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# 2.  REPLACE search_agent_node with this version
# ─────────────────────────────────────────────────────────────────────────────

def search_agent_node(state: Blackboard) -> dict:
    """
    Finds candidate products by:
      a) Querying Amazon search for the user's query (gets real titles + ASINs)
      b) Asking the LLM to pick the most relevant ones from those results
    No Tavily. No react_loop. Pure Amazon data.
    """
    query = state["query"]
    print(f"  🔎 Searching Amazon for: {query}")

    # ── Step 1: pull raw Amazon search results ────────────────────────────────
    try:
        url = "https://real-time-amazon-data.p.rapidapi.com/search"
        headers = {
            "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
            "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
        }
        params = {"query": query, "page": "1", "country": "IN", "sort_by": "RELEVANCE"}
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        raw_products = resp.json().get("data", {}).get("products", []) if resp.status_code == 200 else []
    except Exception as e:
        print(f"  ⚠️  Amazon search failed: {e}")
        raw_products = []

    # Trim to top-15 to stay within token budget
    raw_products = raw_products[:15]

    # Build a clean list for the LLM to reason over
    candidates = [
        {
            "title":  p.get("product_title", ""),
            "asin":   p.get("asin", ""),
            "price":  p.get("product_price") or p.get("product_minimum_offer_price", ""),
            "rating": p.get("product_star_rating", ""),
            "reviews": p.get("product_num_ratings", ""),
        }
        for p in raw_products
        if p.get("product_title")
    ]

    # ── Step 2: LLM picks the 5 most relevant, distinct products ─────────────
    system = (
        "You are a product selection assistant. "
        "Given a list of Amazon search results and the user's original query, "
        "pick the 5 most relevant, distinct products (no duplicates / variants). "
        "Return ONLY raw JSON — no markdown, no backticks:\n"
        '{"products": ["Exact Product Title 1", "Exact Product Title 2", ...]}'
    )
    human_content = (
        f"Query: {query}\n\n"
        f"Amazon results:\n{json.dumps(candidates, indent=2)}\n\n"
        "Return the 5 best matching products as a JSON list of their exact titles."
    )

    response = llm.invoke([
        SystemMessage(content=system),
        HumanMessage(content=human_content),
    ])

    parsed = extract_json(response.content)
    products = parsed.get("products", [p["title"] for p in candidates[:5]])

    # ── Step 3: build an ASIN lookup so downstream agents can use it ──────────
    asin_map = {p["title"]: p["asin"] for p in candidates if p["asin"]}

    formatted_findings = {
        "products":       products,
        "product_count":  len(products),
        "asin_map":       asin_map,          # ← NEW: stored on blackboard for other agents
        "confidence":     0.9 if products else 0.1,
    }

    current_opinions   = state.get("agent_opinions", {})
    current_confidence = state.get("confidence", {})

    print(f"  ✅ Found {len(products)} products via Amazon search")

    return {
        "raw_findings":     [{"agent": "search_agent", "data": formatted_findings}],
        "agent_opinions":   {**current_opinions,   "search_agent": formatted_findings},
        "confidence":       {**current_confidence, "search_agent": formatted_findings["confidence"]},
        "supervisor_notes": [f"[Search Agent] Found {len(products)} products via Amazon | confidence=0.90"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3.  REPLACE human_loop_node with this version
#     — user-added products are validated via Amazon search before being kept
# ─────────────────────────────────────────────────────────────────────────────

def human_loop_node(state: Blackboard) -> dict:
    """
    Shows the confirmed product list to the user.
    If the user adds new product names, each is searched on Amazon to resolve
    it to a real title + ASIN before it's added to the list.
    """
    search_results = state.get("agent_opinions", {}).get("search_agent", {})
    products       = list(search_results.get("products", []))
    asin_map       = dict(search_results.get("asin_map", {}))

    if not products:
        print("⚠️  No products to confirm")
        return {
            "agent_opinions":   state.get("agent_opinions", {}),
            "supervisor_notes": ["[Human Loop] No products found"],
        }

    # ── Show current list ─────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print(f"🔍 Found {len(products)} products:")
    for i, p in enumerate(products, 1):
        print(f"   {i}. {p}")
    print(f"{'─'*60}")

    while True:
        # ── Removal ──────────────────────────────────────────────────────────
        remove_input = input(
            "\n✏️  Remove products (comma-separated numbers) or press Enter to skip: "
        ).strip()

        if remove_input and remove_input.lower() not in ("none", "no", "skip", ""):
            try:
                indices_to_remove = {int(x.strip()) - 1 for x in remove_input.split(",")}
                if any(i < 0 or i >= len(products) for i in indices_to_remove):
                    print(f"❌ Invalid index. Use numbers 1–{len(products)}. Try again.")
                    continue
                products = [p for i, p in enumerate(products) if i not in indices_to_remove]
                print(f"✅ Removed. {len(products)} products remaining.")
            except ValueError:
                print("❌ Invalid format. Use comma-separated numbers. Try again.")
                continue

        # ── Addition — validated via Amazon ──────────────────────────────────
        add_input = input(
            "   Add products (comma-separated names) or press Enter to skip: "
        ).strip()

        if add_input and add_input.lower() not in ("none", "no", "skip", ""):
            raw_additions = [name.strip() for name in add_input.split(",") if name.strip()]

            for name in raw_additions:
                print(f"  🔎 Looking up \"{name}\" on Amazon…")
                try:
                    url = "https://real-time-amazon-data.p.rapidapi.com/search"
                    headers = {
                        "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
                        "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
                    }
                    params = {"query": name, "page": "1", "country": "IN"}
                    resp = requests.get(url, headers=headers, params=params, timeout=10)
                    amz_products = (
                        resp.json().get("data", {}).get("products", [])
                        if resp.status_code == 200 else []
                    )
                except Exception as e:
                    print(f"  ⚠️  Amazon lookup failed for \"{name}\": {e}")
                    amz_products = []

                if amz_products:
                    best = amz_products[0]
                    resolved_title = best.get("product_title", name)
                    resolved_asin  = best.get("asin", "")
                    products.append(resolved_title)
                    if resolved_asin:
                        asin_map[resolved_title] = resolved_asin
                    print(f"  ✅ Resolved to: \"{resolved_title}\" (ASIN: {resolved_asin or 'n/a'})")
                else:
                    # Fall back to the user's raw string if Amazon has nothing
                    products.append(name)
                    print(f"  ⚠️  Not found on Amazon — adding as-is: \"{name}\"")

            print(f"  📦 Total after additions: {len(products)}")

        # ── Final confirmation ────────────────────────────────────────────────
        confirm = input(f"\n   Proceed with {len(products)} products? (y/n): ").strip().lower()
        if confirm in ("y", "yes"):
            print(f"✅ Analysing {len(products)} products…\n")
            break
        elif confirm in ("n", "no"):
            print("❌ Restarting product selection…\n")
            continue
        else:
            print("❌ Please enter 'y' or 'n'.")

    # ── Write updated list + ASIN map back to the blackboard ─────────────────
    updated_search = {**search_results, "products": products, "asin_map": asin_map}
    updated_opinions = {**state.get("agent_opinions", {}), "search_agent": updated_search}

    return {
        "agent_opinions":   updated_opinions,
        "supervisor_notes": [f"[Human Loop] Confirmed {len(products)} products for analysis"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# OPTIONAL BONUS — make review_agent + price_agent use the ASIN map
# so they hit Amazon's product-details endpoint directly (faster, more accurate)
# ─────────────────────────────────────────────────────────────────────────────
#
# In review_agent_node, change:
#
#   amazon_reviews = get_amazon_reviews(product)
#
# to:
#
#   asin_map = state.get("agent_opinions",{}).get("search_agent",{}).get("asin_map",{})
#   asin     = asin_map.get(product)
#   amazon_reviews = get_amazon_reviews_by_asin(asin) if asin else get_amazon_reviews(product)
#
# Then add this helper (replaces the search step in get_amazon_reviews):

def get_amazon_reviews_by_asin(asin: str, region: str = "IN") -> dict:
    """
    Fetch Amazon reviews directly by ASIN — skips the search step,
    so it's faster and guaranteed to hit the right product.
    """
    try:
        headers = {
            "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
            "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
        }
        detail_url = "https://real-time-amazon-data.p.rapidapi.com/product-details"
        detail_resp = requests.get(
            detail_url,
            headers=headers,
            params={"asin": asin, "country": region},
            timeout=10,
        )
        if detail_resp.status_code != 200:
            return {}

        detail_data = detail_resp.json().get("data", {})
        reviews = detail_data.get("top_reviews", []) or detail_data.get("top_reviews_global", [])
        review_texts = [
            {
                "title":    r.get("review_title", ""),
                "body":     r.get("review_comment", ""),
                "stars":    r.get("review_star_rating", "?"),
                "verified": r.get("is_verified_purchase", False),
            }
            for r in reviews[:8]
        ]
        return {
            "asin":              asin,
            "product_title":     detail_data.get("product_title", ""),
            "avg_rating":        detail_data.get("product_star_rating"),
            "num_ratings":       detail_data.get("product_num_ratings"),
            "rating_distribution": detail_data.get("rating_distribution", {}),
            "reviews":           review_texts,
            "about_product":     detail_data.get("about_product", []),
        }
    except Exception as e:
        print(f"⚠️  get_amazon_reviews_by_asin failed: {e}")
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY OF ALL CHANGES
# ─────────────────────────────────────────────────────────────────────────────
#
#  FILE-LEVEL (top of file):
#    - DELETE: from langchain_community.tools.tavily_search import TavilySearchResults
#    - DELETE: search_tool = TavilySearchResults(max_results=5)
#
#  react_loop():
#    - DELETE the "search" action branch (lines with search_tool.invoke)
#      since search_agent no longer uses react_loop at all.
#
#  REPLACE: search_agent_node      → uses Amazon /search directly
#  REPLACE: human_loop_node        → validates additions via Amazon /search
#  ADD:     get_amazon_reviews_by_asin()   → direct ASIN lookup (no search step)
#
#  OPTIONAL in review_agent_node + price_agent_node:
#    - Grab asin_map from state["agent_opinions"]["search_agent"]["asin_map"]
#    - Use get_amazon_reviews_by_asin(asin) when ASIN is known