import json
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.agents.state import Blackboard
from backend.utils.llm import llm
from backend.utils.json_helpers import extract_json
from backend.integrations.amazon import (
    search_amazon, get_product_details, extract_asin_from_url, resolve_product_name
)
from langchain_core.messages import HumanMessage, SystemMessage

# Flag set to True by api.py before invoking the graph
API_MODE = True


def _best_match(llm_title: str, candidates: list) -> str:
    llm_words = set(llm_title.lower().split())
    best, best_score = llm_title, 0
    for t in candidates:
        score = len(llm_words & set(t.lower().split()))
        if score > best_score:
            best, best_score = t, score
    return best


def search_agent_node(state: Blackboard) -> dict:
    query          = state["query"]
    search_keyword = state.get("search_keyword") or query
    asin_map: dict = {}

    # Step 1: Broad Amazon search with optional price filter
    print(f"  🔎 Amazon broad search for: {search_keyword}")
    btype = state.get("budget_type", "none") or "none"
    bmin  = state.get("budget_min", 0) or 0
    bmax  = state.get("budget_max", 0) or 0

    price_params = {}
    if btype != "none" and bmax > 0:
        if btype == "around":
            price_params["min_price"] = int(bmax * 0.80)
            price_params["max_price"] = int(bmax * 1.20)
        elif btype == "under":
            price_params["min_price"] = int(bmax * 0.80)
            price_params["max_price"] = bmax
        else:
            price_params["min_price"] = bmin
            price_params["max_price"] = bmax
        print(f"  💰 Price filter to API: ₹{price_params.get('min_price',0):,} – ₹{price_params['max_price']:,}")

    raw_products = search_amazon(search_keyword, price_params)

    if len(raw_products) < 5 and price_params:
        print(f"  🔄 Only {len(raw_products)} results with price filter — retrying without...")
        raw_products = search_amazon(search_keyword)

    if not raw_products and search_keyword != query:
        print(f"  🔄 Retrying Amazon with full query...")
        raw_products = search_amazon(query)

    print(f"  ✅ Amazon returned {len(raw_products)} raw results")

    image_map: dict = {}
    amazon_candidates = []
    for p in raw_products[:20]:
        title = p.get("product_title", "")
        asin  = p.get("asin", "")
        if not title or not asin:
            continue
        amazon_candidates.append({
            "title":   title,
            "asin":    asin,
            "price":   p.get("product_price") or p.get("product_minimum_offer_price", ""),
            "rating":  p.get("product_star_rating", ""),
            "reviews": p.get("product_num_ratings", ""),
        })
        img = (
            p.get("product_photo") or p.get("product_main_image_url")
            or p.get("thumbnail_image") or p.get("product_thumbnail")
            or (p.get("product_photos") or [None])[0]
        )
        if img:
            image_map[title] = img
        asin_map[title] = asin

    if not amazon_candidates:
        print("  ❌ No candidates found — check RAPIDAPI_KEY")
        empty = {"products": [], "asin_map": {}, "product_cache": {}, "confidence": 0.1}
        return {
            "raw_findings":   [{"agent": "search_agent", "data": empty}],
            "agent_opinions": {**state.get("agent_opinions", {}), "search_agent": empty},
            "confidence":     {**state.get("confidence", {}), "search_agent": 0.1},
            "notes":          ["[Search] No products found — check API keys"],
        }

    # Step 2: LLM picks 2 from top Amazon candidates
    MAX_PRODUCTS = 5
    top_candidates = sorted(amazon_candidates, key=lambda c: float(c.get("rating") or 0), reverse=True)[:15]

    response = llm.invoke([
        SystemMessage(content=(
            "You are a product selection assistant. "
            f"Pick the {MAX_PRODUCTS} most relevant, distinct products (no duplicates/variants) matching the query. "
            "Return ONLY raw JSON — no markdown, no backticks:\n"
            '{"products": ["Exact Product Title 1", ...]}'
        )),
        HumanMessage(content=(
            f"Query: {query}\n\n"
            f"Amazon candidates:\n{json.dumps(top_candidates, indent=2)}\n\n"
            f"Return the {MAX_PRODUCTS} best as a JSON list of their exact Amazon titles."
        )),
    ])

    parsed    = extract_json(response.content)
    llm_picks = parsed.get("products", [c["title"] for c in top_candidates[:MAX_PRODUCTS]])

    amazon_titles = [c["title"] for c in amazon_candidates]
    products = [_best_match(p, amazon_titles) for p in llm_picks]
    seen = set()
    products = [p for p in products if not (p in seen or seen.add(p))]

    # Step 3: Fetch product details in parallel
    print(f"  📦 Fetching product details for {len(products)} products in parallel…")
    product_cache: dict = {}

    def _fetch(product):
        asin = asin_map.get(product)
        if not asin:
            return product, None
        data = get_product_details(asin)
        if data and not data.get("product_image_url"):
            img = image_map.get(product)
            if not img:
                lower = product.lower()
                for k, v in image_map.items():
                    if k.lower()[:30] in lower or lower[:30] in k.lower():
                        img = v
                        break
            if img:
                data["product_image_url"] = img
        return product, data or None

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_fetch, p): p for p in products}
        for future in as_completed(futures):
            product, data = future.result()
            if data:
                product_cache[product] = data
                print(f"     ✅ Cached: {product[:60]}")
            else:
                print(f"     ⚠️  No details for: {product[:60]}")

    print(f"  ✅ Selected {len(products)} products | {len(product_cache)} cached")

    formatted = {
        "products":      products,
        "asin_map":      asin_map,
        "product_cache": product_cache,
        "confidence":    0.9 if products else 0.1,
    }
    return {
        "raw_findings":   [{"agent": "search_agent", "data": formatted}],
        "agent_opinions": {**state.get("agent_opinions", {}), "search_agent": formatted},
        "confidence":     {**state.get("confidence", {}), "search_agent": formatted["confidence"]},
        "notes":          [f"[Search] {len(products)} products selected | {len(product_cache)} details cached"],
    }


def human_loop_node(state: Blackboard) -> dict:
    search_results = state.get("agent_opinions", {}).get("search_agent", {})
    products       = list(search_results.get("products", []))
    asin_map       = dict(search_results.get("asin_map", {}))
    product_cache  = dict(search_results.get("product_cache", {}))

    if API_MODE:
        print(f"[API] Skipping human loop — {len(products)} products proceeding automatically")
        return {
            "agent_opinions": state.get("agent_opinions", {}),
            "notes": ["[Human Loop] Skipped in API mode"],
        }

    if not products:
        print("⚠️  No products to confirm")
        return {
            "agent_opinions": state.get("agent_opinions", {}),
            "notes": ["[Human Loop] No products found"],
        }

    print(f"\n{'─'*60}")
    print(f"🔍 Found {len(products)} products:")
    for i, p in enumerate(products, 1):
        print(f"   {i}. {p}")
    print(f"{'─'*60}")

    while True:
        remove_input = input("\n✏️  Remove products (comma-separated numbers) or press Enter to skip: ").strip()
        if remove_input and remove_input.lower() not in ("none", "no", "skip", ""):
            try:
                indices = {int(x.strip()) - 1 for x in remove_input.split(",")}
                if any(i < 0 or i >= len(products) for i in indices):
                    print(f"❌ Invalid index. Use numbers 1–{len(products)}. Try again.")
                    continue
                products = [p for i, p in enumerate(products) if i not in indices]
                print(f"✅ Removed. {len(products)} products remaining.")
            except ValueError:
                print("❌ Invalid format. Use comma-separated numbers. Try again.")
                continue

        add_input = input("   Add products (comma-separated names) or press Enter to skip: ").strip()
        if add_input and add_input.lower() not in ("none", "no", "skip", ""):
            for name in [n.strip() for n in add_input.split(",") if n.strip()]:
                print(f"  🔎 Looking up \"{name}\" on Amazon…")
                title, asin = resolve_product_name(name)
                products.append(title)
                if asin:
                    asin_map[title] = asin
                    detail = get_product_details(asin)
                    if detail:
                        product_cache[title] = detail
                    print(f"  ✅ Resolved to: \"{title}\" (ASIN: {asin})")
                else:
                    print(f"  ⚠️  Not found on Amazon — adding as-is: \"{title}\"")
            print(f"  📦 Total after additions: {len(products)}")

        confirm = input(f"\n   Proceed with {len(products)} products? (y/n): ").strip().lower()
        if confirm in ("y", "yes"):
            print(f"✅ Analysing {len(products)} products…\n")
            break
        elif confirm in ("n", "no"):
            print("❌ Restarting product selection…\n")
            continue
        else:
            print("❌ Please enter 'y' or 'n'.")

    updated_search   = {**search_results, "products": products, "asin_map": asin_map, "product_cache": product_cache}
    return {
        "agent_opinions": {**state.get("agent_opinions", {}), "search_agent": updated_search},
        "notes":          [f"[Human Loop] Confirmed {len(products)} products for analysis"],
    }


def comparison_search_agent_node(state: Blackboard) -> dict:
    products_to_compare = state.get("comparison_products", [])
    if not products_to_compare:
        empty = {"products": [], "asin_map": {}, "product_cache": {}, "confidence": 0.1}
        return {
            "notes": ["[Comparison Search] No products specified"],
            "agent_opinions": {**state.get("agent_opinions", {}), "search_agent": empty},
            "confidence":     {**state.get("confidence", {}), "search_agent": 0.1},
        }

    print(f"  🔍 Resolving {len(products_to_compare)} products on Amazon…")
    orig_to_resolved: dict = {}

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(resolve_product_name, n): n for n in products_to_compare}
        for future in as_completed(futures):
            orig = futures[future]
            title, asin = future.result()
            orig_to_resolved[orig] = (title, asin)
            print(f"     ✅ Resolved '{orig}' → '{title[:50]}' (ASIN: {asin or 'n/a'})")

    def _url_fallback(orig_name: str, reason: str) -> tuple:
        from backend.api import request_url_from_frontend

        print(f"  [URL_REQUEST] {orig_name}")
        url = request_url_from_frontend(orig_name, reason)
        if not url:
            print(f"  [Search] No URL provided for '{orig_name}' — skipping")
            return orig_name, ""

        asin = extract_asin_from_url(url)
        if not asin:
            print(f"  [Search] Could not extract ASIN from URL for '{orig_name}' — skipping")
            return orig_name, ""

        data = get_product_details(asin)
        if not data:
            print(f"  [Search] No product data for ASIN {asin} — skipping")
            return orig_name, ""

        fetched_title = data.get("product_title", orig_name)
        print(f"  [Search] URL resolved: '{fetched_title[:60]}'")
        return fetched_title, asin

    asin_to_first: dict = {}
    for orig in products_to_compare:
        title, asin = orig_to_resolved.get(orig, (orig, ""))
        if not asin:
            title, asin = _url_fallback(orig, "Could not auto-resolve on Amazon")
            orig_to_resolved[orig] = (title, asin)
        if asin and asin in asin_to_first:
            title, asin = _url_fallback(orig, f"Resolved to same product as '{asin_to_first[asin]}'")
            orig_to_resolved[orig] = (title, asin)
        if asin:
            asin_to_first[asin] = orig

    resolved_products = []
    asin_map: dict = {}
    for orig in products_to_compare:
        title, asin = orig_to_resolved.get(orig, (orig, ""))
        resolved_products.append(title)
        if asin:
            asin_map[title] = asin

    print(f"  📦 Fetching details for {len(resolved_products)} products…")
    product_cache: dict = {}

    def _fetch(product):
        asin = asin_map.get(product)
        if not asin:
            return product, None
        return product, get_product_details(asin) or None

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_fetch, p): p for p in resolved_products}
        for future in as_completed(futures):
            product, data = future.result()
            if data:
                product_cache[product] = data
                print(f"     ✅ Cached: {product[:60]}")
            else:
                print(f"     ⚠️  No details for: {product[:60]}")

    formatted = {
        "products":      resolved_products,
        "asin_map":      asin_map,
        "product_cache": product_cache,
        "confidence":    0.9 if resolved_products else 0.1,
    }
    print(f"  ✅ {len(resolved_products)} products resolved | {len(product_cache)} cached")
    return {
        "raw_findings":   [{"agent": "comparison_search_agent", "data": formatted}],
        "agent_opinions": {**state.get("agent_opinions", {}), "search_agent": formatted},
        "confidence":     {**state.get("confidence", {}), "search_agent": formatted["confidence"]},
        "notes":          [f"[Comparison Search] {len(resolved_products)} products resolved"],
    }
