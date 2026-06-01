"""
Multi-Agent Product Search
- Direct linear routing: search → human_loop → parallel(review+price) → ranker
- Product details fetched once in search agent, shared via state cache
- Adaptive ranker: weights derived from query intent + per-product data quality
"""

import os, json, operator, re

# Set to True by api.py before calling find_best_product
API_MODE = False
from typing import TypedDict, Annotated, List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END, START
import requests
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

from dotenv import load_dotenv
load_dotenv()

from tavily import TavilyClient
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

llm = ChatOpenAI(
    model="deepseek/deepseek-v4-flash",
    openai_api_base="https://openrouter.ai/api/v1",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    temperature=0,
)


# ─────────────────────────────────────────────────────────────────────────────
# JSON EXTRACTION — robust parsing for LLM responses
# ─────────────────────────────────────────────────────────────────────────────

def extract_json(text: str) -> dict:
    """Robustly extract JSON from LLM response — handles markdown, extra text, etc."""
    try:
        return json.loads(text)
    except Exception:
        pass

    cleaned = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end+1])
        except Exception:
            pass

    print(f"\n⚠️  JSON parse failed. Raw LLM output was:\n{'-'*40}\n{text}\n{'-'*40}")
    return {}


# ─────────────────────────────────────────────────────────────────────────────
# API HELPERS — YouTube, Amazon reviews, Amazon pricing
# ─────────────────────────────────────────────────────────────────────────────

def search_youtube(query: str, max_results: int = 2) -> list:
    """Search YouTube via Google Cloud Data API v3 and fetch transcripts."""
    from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
    videos = []
    try:
        resp = requests.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part":       "snippet",
                "q":          f"{query} review",
                "type":       "video",
                "maxResults": max_results,
                "relevanceLanguage": "en",
                "regionCode": "IN",
                "key":        os.getenv("YOUTUBE_API_KEY"),
            },
            timeout=8,
        )
        if resp.status_code != 200:
            print(f"⚠️  YouTube search HTTP {resp.status_code}: {resp.text[:200]}")
            return []

        for item in resp.json().get("items", []):
            vid_id  = item.get("id", {}).get("videoId")
            snippet = item.get("snippet", {})
            title   = snippet.get("title", "")
            channel = snippet.get("channelTitle", "")
            if not vid_id:
                continue

            transcript_text = ""
            try:
                raw = YouTubeTranscriptApi.get_transcript(vid_id, languages=["en", "en-US", "en-GB"])
                transcript_text = " ".join(seg["text"] for seg in raw[:120])
            except (NoTranscriptFound, TranscriptsDisabled):
                transcript_text = "[No transcript available]"
            except Exception as e:
                transcript_text = f"[Transcript error: {e}]"

            videos.append({
                "video_id":   vid_id,
                "title":      title,
                "channel":    channel,
                "url":        f"https://www.youtube.com/watch?v={vid_id}",
                "transcript": transcript_text,
            })

    except Exception as e:
        print(f"⚠️  YouTube search failed: {e}")
    return videos


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
        detail_resp = requests.get(
            "https://real-time-amazon-data.p.rapidapi.com/product-details",
            headers=headers,
            params={"asin": asin, "country": region},
            timeout=20,
        )
        if detail_resp.status_code != 200:
            return {}

        detail_data = detail_resp.json().get("data", {})
        # Debug: print image-related keys once
        img_keys = [k for k in detail_data if "photo" in k.lower() or "image" in k.lower() or "thumbnail" in k.lower()]
        if img_keys:
            print(f"  🖼  Amazon image keys: {img_keys} → {[detail_data[k] for k in img_keys[:2]]}")
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
            "asin":               asin,
            "product_title":      detail_data.get("product_title", ""),
            "avg_rating":         detail_data.get("product_star_rating"),
            "num_ratings":        detail_data.get("product_num_ratings"),
            "rating_distribution": detail_data.get("rating_distribution", {}),
            "reviews":            review_texts,
            "about_product":      detail_data.get("about_product", []),
            "product_price":      detail_data.get("product_price") or detail_data.get("product_minimum_offer_price"),
            "product_url":        detail_data.get("product_url", ""),
            "product_image_url":  detail_data.get("product_photo") or detail_data.get("product_main_image_url") or detail_data.get("product_photos", [None])[0],
        }
    except Exception as e:
        print(f"⚠️  get_amazon_reviews_by_asin failed: {e}")
        return {}




def _resolve_product_name(name: str) -> tuple:
    """Search Amazon for name, use LLM to pick the best-matching result. Returns (title, asin)."""
    try:
        headers = {
            "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
            "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
        }
        resp = requests.get(
            "https://real-time-amazon-data.p.rapidapi.com/search",
            headers=headers,
            params={"query": name, "page": "1", "country": "IN"},
            timeout=15,
        )
        prods = resp.json().get("data", {}).get("products", [])[:5] if resp.status_code == 200 else []
        if not prods:
            return name, ""

        candidates = [{"index": i, "title": p.get("product_title", ""), "asin": p.get("asin", "")}
                      for i, p in enumerate(prods)]

        pick = llm.invoke([
            SystemMessage(
                "Pick the Amazon product that best matches what the user asked for. "
                "Consider exact model name, generation, and variant. "
                "Return ONLY raw JSON: {\"index\": 0}  (0-based index into the candidates list)"
            ),
            HumanMessage(
                f"User wants: \"{name}\"\n\nCandidates:\n{json.dumps(candidates, indent=2)}"
            ),
        ])
        idx  = extract_json(pick.content).get("index", 0)
        best = candidates[min(int(idx), len(candidates) - 1)]

        # Validate: does the picked result actually match what the user asked for?
        validation = llm.invoke([
            SystemMessage(
                "You are a product match validator. "
                "Decide if the resolved Amazon product is genuinely the same product the user asked for. "
                "Be strict about model numbers and generations — 'iPhone 15' ≠ 'iPhone 16'. "
                "Return ONLY raw JSON: {\"match\": true|false, \"reason\": \"short explanation\"}"
            ),
            HumanMessage(
                f"User asked for: \"{name}\"\n"
                f"Amazon resolved to: \"{best['title']}\"\n"
                f"Is this the correct product?"
            ),
        ])
        val = extract_json(validation.content)
        if val.get("match") is False:
            print(f"  ⚠️  LLM validation failed for '{name}': {val.get('reason', '')}")
            print(f"     Resolved to: '{best['title']}' — this may not be the right product")
            return name, ""   # return empty asin so duplicate validator catches it

        return best["title"], best["asin"]
    except Exception as e:
        print(f"  ⚠️  _resolve_product_name failed for \"{name}\": {e}")
        return name, ""


def _extract_asin_from_url(url: str) -> str:
    """Extract ASIN from Amazon URL like /dp/B0XXXXXX or /gp/product/B0XXXXXX"""
    match = re.search(r'/(?:dp|gp/product)/([A-Z0-9]{10})', url)
    return match.group(1) if match else ""


def _fetch_price_by_search(title: str, asin: str = "") -> dict:
    """Search Amazon for a product price when product-details returned no price."""
    try:
        headers = {
            "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
            "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
        }
        resp = requests.get(
            "https://real-time-amazon-data.p.rapidapi.com/search",
            headers=headers,
            params={"query": title[:80], "page": "1", "country": "IN"},
            timeout=15,
        )
        if resp.status_code == 200:
            prods = resp.json().get("data", {}).get("products", [])
            # prefer exact ASIN match with a real price
            for p in prods[:5]:
                if asin and p.get("asin") == asin:
                    price = p.get("product_price") or p.get("product_minimum_offer_price", "")
                    if price:
                        return {"price": price}
            # take first result that actually has a price
            for p in prods[:5]:
                price = p.get("product_price") or p.get("product_minimum_offer_price", "")
                if price:
                    return {"price": price}
    except Exception as e:
        print(f"  ⚠️  Price fallback search failed: {e}")
    return {}


def extract_price_value(price_str: str) -> float:
    """Extract numeric price from string like 'Rs. 45,000' or '$999'"""
    if not price_str:
        return 0.0
    cleaned = re.sub(r'[^\d.]', '', str(price_str))
    try:
        return float(cleaned) if cleaned else 0.0
    except Exception:
        return 0.0


def search_tavily(query: str, max_results: int = 15) -> list:
    """Search the web via Tavily and extract product name candidates using LLM."""
    try:
        results = tavily_client.search(
            query=f"{query} best India",
            max_results=max_results,
            include_answer=True,
        )
        snippets = []
        for r in results.get("results", []):
            title   = r.get("title", "")
            content = r.get("content", "")[:300]
            snippets.append(f"- {title}: {content}")

        if not snippets:
            return []

        response = llm.invoke([
            SystemMessage(content=(
                "You are a product extraction assistant. "
                "Given web search results about products, extract a list of specific product model names. "
                "Return ONLY raw JSON — no markdown, no backticks:\n"
                '{"products": ["Product Model Name 1", "Product Model Name 2", ...]}'
            )),
            HumanMessage(content=(
                f"Query: {query}\n\nWeb search results:\n"
                + "\n".join(snippets)
                + "\n\nExtract up to 15 specific product names mentioned. "
                  "Include brand and model number where available."
            )),
        ])
        parsed = extract_json(response.content)
        return parsed.get("products", [])
    except Exception as e:
        print(f"⚠️  Tavily search failed: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# SHARED BLACKBOARD
# ─────────────────────────────────────────────────────────────────────────────

class Blackboard(TypedDict):
    query:                str
    search_keyword:       str          # clean product keyword for Amazon search
    mode:                 str          # "discovery" | "comparison"
    comparison_products:  List[str]    # populated by intent classifier in comparison mode
    budget_type:          str          # "under" | "around" | "range" | "none"
    budget_min:           int          # lower bound in INR (0 if not a range)
    budget_max:           int          # upper bound in INR (0 if no budget stated)
    raw_findings:         Annotated[List[dict], operator.add]
    agent_opinions:       Dict[str, Any]
    confidence:           Dict[str, float]
    notes:                Annotated[List[str], operator.add]
    final_recommendation: Dict[str, Any]


# ─────────────────────────────────────────────────────────────────────────────
# REACT LOOP HELPER — used by review_agent for analyze / done actions
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# SEARCH AGENT
# ─────────────────────────────────────────────────────────────────────────────

def _score_candidate(candidate: dict, tavily_names: list) -> float:
    """Score an Amazon candidate: +2 if web-recommended, +0-5 from Amazon rating."""
    score = 0.0
    title_lower = candidate["title"].lower()
    for t in tavily_names:
        if any(word in title_lower for word in t.lower().split() if len(word) > 4):
            score += 2.0
            break
    try:
        score += float(candidate.get("rating") or 0)
    except (ValueError, TypeError):
        pass
    return score


def search_agent_node(state: Blackboard) -> dict:
    """
    1. Amazon broad search (1 RapidAPI call)
    2. Tavily web search for hints (1 Tavily call)
    3. LLM scores + picks 5 products (1 LLM call)
    4. Fetch product-details for each ASIN (5 RapidAPI calls) — cached for review+price agents
    """
    query          = state["query"]
    search_keyword = state.get("search_keyword") or query
    asin_map: dict = {}

    # Step 1: Broad Amazon search (clean keyword, not raw query)
    print(f"  🔎 Amazon broad search for: {search_keyword}")
    amz_headers = {
        "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
        "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
    }
    amz_params = {"query": search_keyword, "page": "1", "country": "IN", "sort_by": "RELEVANCE"}
    btype = state.get("budget_type", "none") or "none"
    bmin  = state.get("budget_min", 0) or 0
    bmax  = state.get("budget_max", 0) or 0
    if btype != "none" and bmax > 0:
        if btype == "around":
            amz_params["min_price"] = int(bmax * 0.80)
            amz_params["max_price"] = int(bmax * 1.20)
        elif btype == "under":
            amz_params["min_price"] = int(bmax * 0.80)
            amz_params["max_price"] = bmax
        else:
            amz_params["min_price"] = bmin
            amz_params["max_price"] = bmax
        print(f"  💰 Price filter to API: ₹{amz_params.get('min_price',0):,} – ₹{amz_params['max_price']:,}")
    amz_url = "https://real-time-amazon-data.p.rapidapi.com/search"
    try:
        resp = requests.get(amz_url, headers=amz_headers, params=amz_params, timeout=10)
        raw_products = resp.json().get("data", {}).get("products", []) if resp.status_code == 200 else []
        # If price-filtered but fewer than 5 results, retry without price params
        if len(raw_products) < 5 and "min_price" in amz_params:
            print(f"  🔄 Only {len(raw_products)} results with price filter — retrying without...")
            amz_params.pop("min_price", None)
            amz_params.pop("max_price", None)
            resp2 = requests.get(amz_url, headers=amz_headers, params=amz_params, timeout=10)
            raw_products = resp2.json().get("data", {}).get("products", []) if resp2.status_code == 200 else raw_products
        # Fallback: retry with raw query if clean keyword returned nothing
        if not raw_products and search_keyword != query:
            print(f"  🔄 Retrying Amazon with full query...")
            amz_params["query"] = query
            resp3 = requests.get(amz_url, headers=amz_headers, params=amz_params, timeout=10)
            raw_products = resp3.json().get("data", {}).get("products", []) if resp3.status_code == 200 else []
        print(f"  ✅ Amazon returned {len(raw_products)} raw results")
    except Exception as e:
        print(f"  ⚠️  Amazon search failed: {e}")
        raw_products = []

    image_map: dict = {}  # title -> image url from search results
    amazon_candidates = [
        {
            "title":   p.get("product_title", ""),
            "asin":    p.get("asin", ""),
            "price":   p.get("product_price") or p.get("product_minimum_offer_price", ""),
            "rating":  p.get("product_star_rating", ""),
            "reviews": p.get("product_num_ratings", ""),
        }
        for p in raw_products[:20]
        if p.get("product_title") and p.get("asin")  # only keep products with a valid ASIN
    ]
    for p in raw_products[:20]:
        title = p.get("product_title", "")
        img = (p.get("product_photo") or p.get("product_main_image_url")
               or p.get("thumbnail_image") or p.get("product_thumbnail")
               or (p.get("product_photos") or [None])[0])
        if title and img:
            image_map[title] = img
    for c in amazon_candidates:
        asin_map[c["title"]] = c["asin"]

    if not amazon_candidates:
        print("  ❌ No candidates found — check RAPIDAPI_KEY")
        empty = {"products": [], "asin_map": {}, "product_cache": {}, "confidence": 0.1}
        return {
            "raw_findings":   [{"agent": "search_agent", "data": empty}],
            "agent_opinions": {**state.get("agent_opinions", {}), "search_agent": empty},
            "confidence":     {**state.get("confidence", {}), "search_agent": 0.1},
            "notes":          ["[Search] No products found — check API keys"],
        }

    # Step 2: Tavily — web recommendation hints only, no extra API calls
    # Step 2: LLM picks 5 from top Amazon candidates (sorted by rating)
    top_candidates = sorted(amazon_candidates, key=lambda c: float(c.get("rating") or 0), reverse=True)[:15]

    response = llm.invoke([
        SystemMessage(content=(
            "You are a product selection assistant. "
            "Pick the 5 most relevant, distinct products (no duplicates/variants) matching the query. "
            "Return ONLY raw JSON — no markdown, no backticks:\n"
            '{"products": ["Exact Product Title 1", ...]}'
        )),
        HumanMessage(content=(
            f"Query: {query}\n\n"
            f"Amazon candidates:\n{json.dumps(top_candidates, indent=2)}\n\n"
            "Return the 5 best as a JSON list of their exact Amazon titles."
        )),
    ])

    parsed      = extract_json(response.content)
    llm_picks   = parsed.get("products", [c["title"] for c in top_candidates[:5]])

    # Resolve LLM titles back to exact Amazon titles (LLM sometimes rewrites them slightly)
    # Match each LLM pick to the nearest Amazon candidate title by shared word overlap
    amazon_titles = [c["title"] for c in amazon_candidates]

    def _best_match(llm_title: str, candidates: list) -> str:
        llm_words = set(llm_title.lower().split())
        best, best_score = llm_title, 0
        for t in candidates:
            score = len(llm_words & set(t.lower().split()))
            if score > best_score:
                best, best_score = t, score
        return best

    products = [_best_match(p, amazon_titles) for p in llm_picks]
    # Deduplicate while preserving order
    seen = set()
    products = [p for p in products if not (p in seen or seen.add(p))]

    # Step 4: Fetch product-details in parallel — one thread per product
    from concurrent.futures import ThreadPoolExecutor, as_completed
    print(f"  📦 Fetching product details for {len(products)} products in parallel…")
    product_cache: dict = {}

    def _fetch(product):
        asin = asin_map.get(product)
        if not asin:
            return product, None
        data = get_amazon_reviews_by_asin(asin)
        if data:
            # Fill image from search-result thumbnail if detail API didn't return one
            if not data.get("product_image_url"):
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

    formatted_findings = {
        "products":      products,
        "asin_map":      asin_map,
        "product_cache": product_cache,
        "confidence":    0.9 if products else 0.1,
    }

    print(f"  ✅ Selected {len(products)} products | {len(product_cache)} cached")

    return {
        "raw_findings":   [{"agent": "search_agent", "data": formatted_findings}],
        "agent_opinions": {**state.get("agent_opinions", {}), "search_agent": formatted_findings},
        "confidence":     {**state.get("confidence", {}), "search_agent": formatted_findings["confidence"]},
        "notes":          [f"[Search] {len(products)} products selected | {len(product_cache)} details cached"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# HUMAN LOOP — user confirms/modifies product list; additions validated via Amazon
# ─────────────────────────────────────────────────────────────────────────────

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
            "agent_opinions":   state.get("agent_opinions", {}),
            "notes": ["[Human Loop] No products found"],
        }

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
                resolved_title, resolved_asin = _resolve_product_name(name)
                products.append(resolved_title)
                if resolved_asin:
                    asin_map[resolved_title] = resolved_asin
                    detail = get_amazon_reviews_by_asin(resolved_asin)
                    if detail:
                        product_cache[resolved_title] = detail
                    print(f"  ✅ Resolved to: \"{resolved_title}\" (ASIN: {resolved_asin})")
                else:
                    print(f"  ⚠️  Not found on Amazon — adding as-is: \"{resolved_title}\"")

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

    updated_search   = {**search_results, "products": products, "asin_map": asin_map, "product_cache": product_cache}
    updated_opinions = {**state.get("agent_opinions", {}), "search_agent": updated_search}

    return {
        "agent_opinions": updated_opinions,
        "notes":          [f"[Human Loop] Confirmed {len(products)} products for analysis"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# REVIEW AGENT
# ─────────────────────────────────────────────────────────────────────────────

def review_agent_node(state: Blackboard) -> dict:
    system = """You are a review and sentiment analyst.
- Analyse real Amazon customer reviews and YouTube video transcripts
- Score each product 0-100 based on what real users and reviewers actually said
- Weight verified Amazon purchases heavily; treat YouTube transcripts as expert opinion
- Be specific — quote or paraphrase actual review content where possible
Return ONLY raw JSON:
{
  "rating": 0-100,
  "benefits": ["..."],
  "losses": ["..."],
  "sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0,
  "review_highlights": ["key quote 1", "key quote 2"]
}"""

    search_results = state.get("agent_opinions", {}).get("search_agent", {})
    products       = search_results.get("products", [])
    product_cache  = search_results.get("product_cache", {})

    if not products:
        print("⚠️  [Review Agent] No products from search agent")
        return {
            "agent_opinions": {**state.get("agent_opinions", {}), "review_agent": {}},
            "confidence":     {**state.get("confidence", {}), "review_agent": 0.0},
            "notes":          ["[Review] No products to review"],
        }

    findings = {"products_analyzed": {}}

    def _review_product(product):
        print(f"  📺 Reviewing: {product[:70]}")
        yt_results     = search_youtube(product, max_results=4)
        amazon_reviews = product_cache.get(product, {})

        yt_section = ""
        for v in yt_results:
            snippet = v["transcript"][:1500] if v["transcript"] else "[none]"
            yt_section += f"\n### YouTube: {v['title']} ({v['channel']})\n{snippet}\n"

        amz_section = ""
        if amazon_reviews:
            amz_section = (
                f"\n### Amazon ({amazon_reviews.get('avg_rating','?')}⭐, "
                f"{amazon_reviews.get('num_ratings','?')} ratings)\n"
                f"Rating distribution: {amazon_reviews.get('rating_distribution', {})}\n"
            )
            for r in amazon_reviews.get("reviews", []):
                tag = "✅ Verified" if r.get("verified") else "Unverified"
                amz_section += f"- [{r.get('stars','?')}★ {tag}] {r.get('title','')}: {r.get('body','')[:300]}\n"

        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=(
                f"Product: {product}\n\n"
                f"{yt_section or 'No YouTube transcripts found.'}\n\n"
                f"{amz_section or 'No Amazon reviews found.'}\n\n"
                "Return ONLY raw JSON."
            )),
        ])

        result = extract_json(response.content)
        if not result:
            result = {
                "rating": 50, "benefits": [], "losses": ["Limited review data available"],
                "sentiment": "neutral", "confidence": 0.3, "review_highlights": [],
            }
            print(f"     ⚠️  JSON parse failed — fallback 50/100")

        print(f"     ✅ Rating: {result.get('rating','?')}/100 | YT: {len(yt_results)} | Reviews: {len(amazon_reviews.get('reviews', []))}")
        return product, result

    from concurrent.futures import ThreadPoolExecutor, as_completed
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_review_product, p): p for p in products[:5]}
        for future in as_completed(futures):
            product, result = future.result()
            findings["products_analyzed"][product] = result

    avg_confidence = (
        sum(v.get("confidence", 0) for v in findings["products_analyzed"].values())
        / max(len(findings["products_analyzed"]), 1)
    )

    return {
        "raw_findings":   [{"agent": "review_agent", "data": findings}],
        "agent_opinions": {**state.get("agent_opinions", {}), "review_agent": findings},
        "confidence":     {**state.get("confidence", {}), "review_agent": avg_confidence},
        "notes":          [f"[Review] {len(findings['products_analyzed'])} products | confidence={avg_confidence:.2f}"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# PRICE AGENT
# ─────────────────────────────────────────────────────────────────────────────

def price_agent_node(state: Blackboard) -> dict:
    search_results = state.get("agent_opinions", {}).get("search_agent", {})
    products       = search_results.get("products", [])
    product_cache  = search_results.get("product_cache", {})

    if not products:
        print("⚠️  [Price Agent] No products from search agent")
        return {
            "agent_opinions": {**state.get("agent_opinions", {}), "price_agent": {}},
            "confidence":     {**state.get("confidence", {}), "price_agent": 0.0},
            "notes":          ["[Price] No products to price"],
        }

    findings = {"products_analyzed": {}}

    for product in products[:5]:
        print(f"  💰 Pricing: {product}")
        cached = product_cache.get(product, {})

        if cached:
            price_str = cached.get("product_price", "")
            price_inr = extract_price_value(price_str)

            if price_inr == 0:
                asin = search_results.get("asin_map", {}).get(product, "")
                fallback = _fetch_price_by_search(product, asin)
                fb_price = extract_price_value(fallback.get("price", ""))
                if fb_price > 0:
                    price_inr = fb_price
                    price_str = fallback.get("price", "")
                    print(f"     💡 Price from fallback search: ₹{price_inr}")

            findings["products_analyzed"][product] = {
                "price_inr":            price_inr,
                "price_usd_equivalent": price_inr / 95,
                "availability":         price_inr > 0,
                "reviews_count":        cached.get("num_ratings", 0),
                "url":                  cached.get("product_url", ""),
                "price_score":          0,
            }
            print(f"     ✅ ₹{price_inr} (from cache)")
        else:
            findings["products_analyzed"][product] = {"price_score": 0, "error": "Not in cache"}
            print(f"     ⚠️  No cached data for {product[:50]}")

    # Price scoring: 100 * min_price / price
    # A product 10% more expensive scores ~91, not 0 — reflects actual value difference
    valid_prices = {
        name: data["price_inr"]
        for name, data in findings["products_analyzed"].items()
        if data.get("price_inr", 0) > 0
    }
    if valid_prices:
        min_p = min(valid_prices.values())
        for name in findings["products_analyzed"]:
            p = findings["products_analyzed"][name].get("price_inr", 0)
            if p > 0:
                findings["products_analyzed"][name]["price_score"] = round(10 * min_p / p, 1)

    priced_count   = sum(1 for v in findings["products_analyzed"].values() if v.get("price_inr", 0) > 0)
    total_count    = max(len(findings["products_analyzed"]), 1)
    avg_confidence = priced_count / total_count
    print(f"  ✅ Pricing complete: {priced_count}/{total_count} products priced")

    return {
        "raw_findings":   [{"agent": "price_agent", "data": findings}],
        "agent_opinions": {**state.get("agent_opinions", {}), "price_agent": findings},
        "confidence":     {**state.get("confidence", {}), "price_agent": avg_confidence},
        "notes":          [f"[Price] {priced_count}/{total_count} products priced | confidence={avg_confidence:.2f}"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# RANKER AGENT
# ─────────────────────────────────────────────────────────────────────────────

def ranker_agent_node(state: Blackboard) -> dict:
    import time as _time
    _time.sleep(2)
    opinions     = state.get("agent_opinions", {})
    review_data  = opinions.get("review_agent", {}).get("products_analyzed", {})
    price_data   = opinions.get("price_agent",  {}).get("products_analyzed", {})
    product_cache = opinions.get("search_agent", {}).get("product_cache", {})
    query       = state["query"]

    # Step A: derive weights from query intent (1 LLM call)
    # Base bias: quality 0.8, price 0.1, availability 0.1
    # LLM can shift weights but quality always dominates unless query is explicitly price-focused
    weight_resp = llm.invoke([
        SystemMessage(content=(
            "You assign product ranking weights based on what a query implies. "
            "Weights must sum to exactly 1.0. "
            "Default bias: quality=0.8, price=0.1, availability=0.1. "
            "Only shift price higher if the query explicitly mentions a budget or price limit. "
            "Quality should always be the dominant weight (minimum 0.6). "
            "Return ONLY raw JSON: {\"quality\": 0.0-1.0, \"price\": 0.0-1.0, \"availability\": 0.0-1.0}\n"
            "Examples:\n"
            "- 'best gaming laptop' → quality:0.8, price:0.1, availability:0.1\n"
            "- 'best laptop under 50000' → quality:0.6, price:0.3, availability:0.1\n"
            "- 'best laptop for office' → quality:0.8, price:0.1, availability:0.1"
        )),
        HumanMessage(content=f"Query: \"{query}\""),
    ])
    base_w = extract_json(weight_resp.content)
    # Fixed weights: quality 80%, price 10%, availability 10%
    q_w = 0.8
    p_w = 0.1
    a_w = 0.1
    print(f"  ⚖️  Weights — quality:{q_w:.0%} price:{p_w:.0%} availability:{a_w:.0%}")

    ranked_products = []

    for product_name in set(list(review_data.keys()) + list(price_data.keys())):
        rd = review_data.get(product_name, {})
        pd = price_data.get(product_name, {})

        quality_score      = float(rd.get("rating", 0) or 0)            # 0–100
        price_score        = min(float(pd.get("price_score", 0) or 0) * 10, 100.0)  # 0–10 → 0–100
        availability_score = 100.0 if pd.get("availability", False) else 0.0        # 0 or 100

        # Step B: per-product data-quality adjustment
        review_conf = float(rd.get("confidence", 1.0) or 1.0)
        if review_conf < 0.5:
            # Redistribute quality weight toward price + availability
            eff_q = q_w * review_conf
            redistributed = q_w - eff_q
            eff_p = p_w + redistributed * 0.7
            eff_a = a_w + redistributed * 0.3
        else:
            eff_q, eff_p, eff_a = q_w, p_w, a_w

        combined_score = (quality_score * eff_q) + (price_score * eff_p) + (availability_score * eff_a)

        ranked_products.append({
            "name":               product_name,
            "combined_score":     combined_score,
            "quality_score":      quality_score,
            "price_score":        price_score,
            "availability_score": availability_score,
            "eff_weights":        {"quality": eff_q, "price": eff_p, "availability": eff_a},
            "review_data":        rd,
            "price_data":         pd,
        })

    ranked_products.sort(key=lambda x: x["combined_score"], reverse=True)
    winner = ranked_products[0] if ranked_products else None
    if winner:
        print(f"  🏆 Winner: {winner['name'][:60]}")

    def _get_image(name):
        """Fuzzy lookup product_image_url from product_cache."""
        if name in product_cache:
            return product_cache[name].get("product_image_url")
        lower = name.lower()
        for k, v in product_cache.items():
            if k.lower()[:30] in lower or lower[:30] in k.lower():
                return v.get("product_image_url")
        return None

    result = {
        "ranked": [
            {
                "rank":              i + 1,
                "name":              p["name"],
                "score":             round(p["combined_score"], 1),
                "quality":           round(p["quality_score"], 1),
                "price_score":       round(p["price_score"], 1),
                "price_inr":         p["price_data"].get("price_inr", "N/A"),
                "availability":      "✅ In Stock" if p["price_data"].get("availability") else "❌ N/A",
                "url":               p["price_data"].get("url", "N/A"),
                "product_image_url": _get_image(p["name"]),
            }
            for i, p in enumerate(ranked_products[:10])
        ],
        "winner": {
            "name":           winner["name"] if winner else "Not found",
            "combined_score": round(winner["combined_score"], 1) if winner else 0,
            "quality_score":  round(winner["quality_score"], 1) if winner else 0,
            "price_score":    round(winner["price_score"], 1) if winner else 0,
            "availability":   "In Stock" if (winner and winner["price_data"].get("availability")) else "Out of Stock",
            "price_inr":      winner["price_data"].get("price_inr", "N/A") if winner else "N/A",
            "reviews":        winner["price_data"].get("reviews_count", 0) if winner else 0,
            "url":            winner["price_data"].get("url", "N/A") if winner else "N/A",
            "why": (
                f"Query intent weights — quality:{q_w:.0%} × price:{p_w:.0%} × availability:{a_w:.0%}. "
                f"Score: {winner['quality_score']:.0f}×{winner['eff_weights']['quality']:.2f} + "
                f"{winner['price_score']:.0f}×{winner['eff_weights']['price']:.2f} + "
                f"{winner['availability_score']:.0f}×{winner['eff_weights']['availability']:.2f} = "
                f"{winner['combined_score']:.1f}/100"
            ) if winner else "No products found",
            "benefits":          winner["review_data"].get("benefits", []) if winner else [],
            "losses":            winner["review_data"].get("losses",   []) if winner else [],
            "confidence":        min(0.95, winner["combined_score"] / 100) if winner else 0.1,
            "product_image_url": _get_image(winner["name"]) if winner else None,
        },
        "weights_used":    {"quality": q_w, "price": p_w, "availability": a_w},
        "methodology":     f"Adaptive weights from query intent | peer-relative price scoring",
        "synthesis_notes": f"Evaluated {len(ranked_products)} products",
    }

    return {
        "agent_opinions":   {**state.get("agent_opinions", {}), "ranker": result},
        "confidence":       {**state.get("confidence", {}), "ranker": result["winner"]["confidence"]},
        "final_recommendation": result,
        "notes":            [f"[Ranker] Winner: {result['winner']['name']} | score: {result['winner']['combined_score']}/100"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# PARALLEL AGENTS — review + price run in threads, both read from cache
# ─────────────────────────────────────────────────────────────────────────────

def parallel_agents_node(state: Blackboard) -> dict:
    from concurrent.futures import ThreadPoolExecutor, as_completed

    print(f"\n⚡ Running Review & Price agents in parallel…\n")

    results = {}

    def run_review(): results["review"] = review_agent_node(state)
    def run_price():  results["price"]  = price_agent_node(state)

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = {executor.submit(run_review): "review", executor.submit(run_price): "price"}
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                print(f"⚠️  [{futures[future]}] thread failed: {e}")
                results.setdefault(futures[future], {})

    review_result = results.get("review", {})
    price_result  = results.get("price",  {})

    return {
        "raw_findings":   (
            state.get("raw_findings", [])
            + review_result.get("raw_findings", [])
            + price_result.get("raw_findings",  [])
        ),
        "agent_opinions": {
            **state.get("agent_opinions", {}),
            "review_agent": review_result.get("agent_opinions", {}).get("review_agent", {}),
            "price_agent":  price_result.get("agent_opinions",  {}).get("price_agent",  {}),
        },
        "confidence": {
            **state.get("confidence", {}),
            **review_result.get("confidence", {}),
            **price_result.get("confidence",  {}),
        },
        "notes": review_result.get("notes", []) + price_result.get("notes", []),
    }


# ─────────────────────────────────────────────────────────────────────────────
# INTENT CLASSIFIER — detects discovery vs comparison mode
# ─────────────────────────────────────────────────────────────────────────────

def intent_classifier_node(state: Blackboard) -> dict:
    response = llm.invoke([
        SystemMessage(content=(
            "Classify a product query into one of two modes:\n"
            "- \"discovery\": user wants to find/recommend the best product "
            "(e.g. 'best phone under 30000', 'which laptop for gaming')\n"
            "- \"comparison\": user explicitly names 2+ specific products to compare "
            "(e.g. 'compare iPhone 15 vs Samsung S24', 'OnePlus 12 or Pixel 9 which is better')\n"
            "Also extract budget information:\n"
            "- \"budget_type\": \"under\" (under/below/max/within), \"around\" (around/approximately/about), "
            "\"range\" (between X and Y), or \"none\" if no budget mentioned\n"
            "- \"budget_min\": lower bound in INR (0 if not a range; convert USD/EUR to INR)\n"
            "- \"budget_max\": upper bound in INR (0 if no budget mentioned; convert USD/EUR to INR)\n"
            "Examples: 'under 1000' → type=under, min=0, max=1000\n"
            "          'around 20000' → type=around, min=0, max=20000\n"
            "          'between 1000 and 2000' → type=range, min=1000, max=2000\n"
            "- \"search_keyword\": 2-4 word clean product keyword for Amazon search "
            "(remove budget, question words, filler, typos). e.g. 'earphone', 'gaming laptop'\n"
            "Return ONLY raw JSON: {\"mode\": \"discovery\"|\"comparison\", \"products\": [\"name1\", \"name2\"], "
            "\"budget_type\": \"none\", \"budget_min\": 0, \"budget_max\": 0, \"search_keyword\": \"\"}\n"
            "products list is only populated for comparison mode, otherwise []."
        )),
        HumanMessage(content=f"Query: {state['query']}"),
    ])
    result         = extract_json(response.content)
    mode           = result.get("mode", "discovery")
    products       = result.get("products", [])
    budget_type    = result.get("budget_type", "none") or "none"
    budget_min     = int(result.get("budget_min", 0) or 0)
    budget_max     = int(result.get("budget_max", 0) or 0)
    search_keyword = result.get("search_keyword", "").strip() or state["query"]
    print(f"  🧭 Mode: {mode.upper()}" + (f" | Products: {products}" if products else ""))
    print(f"  🔑 Amazon keyword: {search_keyword}")
    if budget_type != "none" and budget_max > 0:
        print(f"  💰 Budget: {budget_type} ₹{budget_max:,}" + (f" (min ₹{budget_min:,})" if budget_min else ""))
    return {"mode": mode, "comparison_products": products,
            "budget_type": budget_type, "budget_min": budget_min, "budget_max": budget_max,
            "search_keyword": search_keyword}


def route_from_classifier(state: Blackboard) -> str:
    return "comparison_search_agent" if state.get("mode") == "comparison" else "search_agent"


# ─────────────────────────────────────────────────────────────────────────────
# COMPARISON SEARCH AGENT — resolves known product names to ASINs, no Tavily
# ─────────────────────────────────────────────────────────────────────────────

def comparison_search_agent_node(state: Blackboard) -> dict:
    products_to_compare = state.get("comparison_products", [])
    if not products_to_compare:
        return {
            "notes": ["[Comparison Search] No products specified"],
            "agent_opinions": {**state.get("agent_opinions", {}),
                               "search_agent": {"products": [], "asin_map": {}, "product_cache": {}, "confidence": 0.1}},
            "confidence": {**state.get("confidence", {}), "search_agent": 0.1},
        }

    print(f"  🔍 Resolving {len(products_to_compare)} products on Amazon…")
    asin_map: dict = {}
    resolved_products: list = []

    from concurrent.futures import ThreadPoolExecutor, as_completed

    # Resolve in parallel, preserving mapping from original name → (title, asin)
    orig_to_resolved: dict = {}  # orig_name → (title, asin)
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_resolve_product_name, n): n for n in products_to_compare}
        for future in as_completed(futures):
            orig_name = futures[future]
            title, asin = future.result()
            orig_to_resolved[orig_name] = (title, asin)
            print(f"     ✅ Resolved '{orig_name}' → '{title[:50]}' (ASIN: {asin or 'n/a'})")

    def _ask_url_fallback(orig_name: str, reason: str) -> tuple:
        """Ask user for Amazon URL when auto-resolution fails. Returns (title, asin) or (orig_name, '')."""
        print(f"\n  ⚠️  Could not auto-resolve '{orig_name}': {reason}")
        print(f"     Please paste the Amazon India product URL for '{orig_name}'.")
        print(f"     (e.g. https://www.amazon.in/dp/B0XXXXXXXX — or press Enter to skip)")
        url = input(f"  🔗 URL for '{orig_name}': ").strip()
        if not url:
            print(f"  ⏭️  Skipped '{orig_name}'")
            return orig_name, ""
        new_asin = _extract_asin_from_url(url)
        if not new_asin:
            print(f"  ⚠️  Could not extract ASIN from URL — skipping '{orig_name}'")
            return orig_name, ""
        data = get_amazon_reviews_by_asin(new_asin)
        if data:
            new_title = data.get("product_title", orig_name)
            print(f"  ✅ Resolved '{orig_name}' → '{new_title}' (ASIN: {new_asin})")
            return new_title, new_asin
        print(f"  ⚠️  Could not fetch details for ASIN {new_asin} — skipping '{orig_name}'")
        return orig_name, ""

    # Validate resolutions: prompt URL for both failed validation (no ASIN) and duplicate ASINs
    asin_to_first: dict = {}
    for orig_name in products_to_compare:
        title, asin = orig_to_resolved.get(orig_name, (orig_name, ""))

        if not asin:
            # Validation failed — Amazon returned wrong product
            title, asin = _ask_url_fallback(orig_name, "auto-resolution returned a different product")
            orig_to_resolved[orig_name] = (title, asin)

        if asin and asin in asin_to_first:
            first_name = asin_to_first[asin]
            title, asin = _ask_url_fallback(
                orig_name,
                f"resolved to the same product as '{first_name}' (ASIN: {asin})"
            )
            orig_to_resolved[orig_name] = (title, asin)

        if asin:
            asin_to_first[asin] = orig_name

    # Build final resolved_products and asin_map from validated pairs
    for orig_name in products_to_compare:
        title, asin = orig_to_resolved.get(orig_name, (orig_name, ""))
        resolved_products.append(title)
        if asin:
            asin_map[title] = asin

    # Fetch product details in parallel
    print(f"  📦 Fetching details for {len(resolved_products)} products…")
    product_cache: dict = {}

    def _fetch(product):
        asin = asin_map.get(product)
        if not asin:
            return product, None
        data = get_amazon_reviews_by_asin(asin)
        return product, data or None

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_fetch, p): p for p in resolved_products}
        for future in as_completed(futures):
            product, data = future.result()
            if data:
                product_cache[product] = data
                print(f"     ✅ Cached: {product[:60]}")
            else:
                print(f"     ⚠️  No details for: {product[:60]}")

    formatted_findings = {
        "products":      resolved_products,
        "asin_map":      asin_map,
        "product_cache": product_cache,
        "confidence":    0.9 if resolved_products else 0.1,
    }

    print(f"  ✅ {len(resolved_products)} products resolved | {len(product_cache)} cached")
    return {
        "raw_findings":   [{"agent": "comparison_search_agent", "data": formatted_findings}],
        "agent_opinions": {**state.get("agent_opinions", {}), "search_agent": formatted_findings},
        "confidence":     {**state.get("confidence", {}), "search_agent": formatted_findings["confidence"]},
        "notes":          [f"[Comparison Search] {len(resolved_products)} products resolved"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# COMPARISON RANKER — side-by-side table + LLM verdict
# ─────────────────────────────────────────────────────────────────────────────

def comparison_ranker_node(state: Blackboard) -> dict:
    opinions    = state.get("agent_opinions", {})
    review_data = opinions.get("review_agent", {}).get("products_analyzed", {})
    price_data  = opinions.get("price_agent",  {}).get("products_analyzed", {})
    query       = state["query"]


    comparison_table = []
    for product in set(list(review_data.keys()) + list(price_data.keys())):
        rd = review_data.get(product, {})
        pd = price_data.get(product, {})
        comparison_table.append({
            "name":         product,
            "quality":      float(rd.get("rating", 50) or 50),
            "price_inr":    pd.get("price_inr", 0),
            "price_score":  float(pd.get("price_score", 0) or 0),
            "availability": "✅ In Stock" if pd.get("availability") else "❌ N/A",
            "url":          pd.get("url", ""),
            "benefits":     rd.get("benefits", []),
            "losses":       rd.get("losses", []),
            "sentiment":    rd.get("sentiment", "neutral"),
            "highlights":   rd.get("review_highlights", []),
            "confidence":   rd.get("confidence", 0.3),
        })

    comparison_table.sort(key=lambda x: x["quality"], reverse=True)

    # LLM verdict: who should buy which
    verdict_resp = llm.invoke([
        SystemMessage(content=(
            "You are a product comparison expert. Given product scores and review highlights, "
            "write a concise verdict in 3-5 sentences explaining who should buy each product. "
            "Be specific about use cases. Return ONLY raw JSON: "
            "{\"verdict\": \"...\", \"best_value\": \"product name\", \"best_performance\": \"product name\"}"
        )),
        HumanMessage(content=(
            f"Query: {query}\n\n"
            f"Products:\n{json.dumps([{k: v for k, v in p.items() if k != 'url'} for p in comparison_table], indent=2)}"
        )),
    ])
    verdict_data = extract_json(verdict_resp.content)
    verdict      = verdict_data.get("verdict", "See comparison table above.")
    best_value   = verdict_data.get("best_value", "")
    best_perf    = verdict_data.get("best_performance", "")

    result = {
        "mode":            "comparison",
        "comparison_table": comparison_table,
        "verdict":         verdict,
        "best_value":      best_value,
        "best_performance": best_perf,
    }

    return {
        "agent_opinions":   {**state.get("agent_opinions", {}), "comparison_ranker": result},
        "confidence":       {**state.get("confidence", {}), "comparison_ranker": 0.9},
        "final_recommendation": result,
        "notes":            [f"[Comparison Ranker] {len(comparison_table)} products compared"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# GRAPH — direct linear routing, no supervisor
# ─────────────────────────────────────────────────────────────────────────────

def route_after_parallel(state: Blackboard) -> str:
    return "comparison_ranker" if state.get("mode") == "comparison" else "ranker_agent"


def build_graph() -> StateGraph:
    g = StateGraph(Blackboard)

    # Shared nodes
    g.add_node("intent_classifier",        intent_classifier_node)
    g.add_node("parallel_agents",          parallel_agents_node)

    # Discovery path
    g.add_node("search_agent",             search_agent_node)
    g.add_node("human_loop",               human_loop_node)
    g.add_node("ranker_agent",             ranker_agent_node)

    # Comparison path
    g.add_node("comparison_search_agent",  comparison_search_agent_node)
    g.add_node("comparison_ranker",        comparison_ranker_node)

    # Entry
    g.add_edge(START, "intent_classifier")

    # Branch after classifier
    g.add_conditional_edges(
        "intent_classifier", route_from_classifier,
        {"search_agent": "search_agent", "comparison_search_agent": "comparison_search_agent"},
    )

    # Discovery path
    g.add_edge("search_agent",            "human_loop")
    g.add_edge("human_loop",              "parallel_agents")

    # Comparison path
    g.add_edge("comparison_search_agent", "parallel_agents")

    # After parallel — branch to correct ranker based on mode
    g.add_conditional_edges(
        "parallel_agents", route_after_parallel,
        {"ranker_agent": "ranker_agent", "comparison_ranker": "comparison_ranker"},
    )

    g.add_edge("ranker_agent",    END)
    g.add_edge("comparison_ranker", END)

    return g.compile()


# ─────────────────────────────────────────────────────────────────────────────
# RUNNER
# ─────────────────────────────────────────────────────────────────────────────

def find_best_product(query: str) -> dict:
    app = build_graph()
    print(app.get_graph().draw_ascii())

    initial: Blackboard = {
        "query":                query,
        "mode":                 "discovery",
        "comparison_products":  [],
        "raw_findings":         [],
        "agent_opinions":       {},
        "confidence":           {},
        "notes":                [],
        "final_recommendation": {},
    }

    print(f"\n🔍 Searching for: {query}\n{'─'*50}")

    final = None
    last_opinions = {}
    for step in app.stream(initial, stream_mode="updates"):
        for node_name, output in step.items():
            for note in output.get("notes", []):
                print(f"  {note}")
            if "agent_opinions" in output:
                last_opinions.update(output["agent_opinions"])
        final = step

    final = final or {}

    # Determine which ranker ran
    rec = (
        final.get("comparison_ranker", {}).get("final_recommendation")
        or final.get("ranker_agent", {}).get("final_recommendation")
        or {}
    )
    mode = rec.get("mode", "discovery")

    print(f"\n{'─'*60}")

    if mode == "comparison":
        # ── Comparison output ────────────────────────────────────────────────
        table  = rec.get("comparison_table", [])
        verdict = rec.get("verdict", "")
        print(f"📊 COMPARISON RESULTS ({len(table)} products)\n")
        print(f"   {'Product':<35} {'Quality':>7}  {'PriceVal':>8}  {'Price(₹)':>10}  {'Avail':<12}  Sentiment")
        print(f"   {'─'*90}")
        for p in table:
            price_str = f"₹{int(p['price_inr'])}" if isinstance(p.get('price_inr'), (int, float)) and p['price_inr'] else "N/A"
            print(
                f"   {p['name'][:35]:<35} "
                f"{p['quality']:>7.1f}  "
                f"{p['price_score']:>8.1f}  "
                f"{price_str:>10}  "
                f"{p['availability']:<12}  "
                f"{p['sentiment']}"
            )
        print(f"\n   🏅 Best Value:       {rec.get('best_value', 'N/A')}")
        print(f"   🚀 Best Performance: {rec.get('best_performance', 'N/A')}")
        print(f"\n   📝 Verdict:\n   {verdict}")
        print()
        for p in table:
            print(f"   {p['name'][:60]}")
            if p["benefits"]:
                print(f"     ✅ Pros: {', '.join(p['benefits'][:3])}")
            if p["losses"]:
                print(f"     ❌ Cons: {', '.join(p['losses'][:2])}")
            if p.get("url"):
                print(f"     🛒 {p['url']}")
            print()
        return {
            "final_recommendation": rec,
            "agent_opinions": last_opinions,
            "mode": "comparison",
        }

    else:
        # ── Discovery output ─────────────────────────────────────────────────
        winner  = rec.get("winner", {})
        ranked  = rec.get("ranked", [])
        weights = rec.get("weights_used", {})
        print(f"🏆 WINNER: {winner.get('name', 'Not found')}")
        print(f"   Combined Score:  {winner.get('combined_score', 'N/A')}/100")
        print(f"   Quality Score:   {winner.get('quality_score',  'N/A')}/100 ({weights.get('quality', 0):.0%} weight)")
        print(f"   Price Score:     {winner.get('price_score',    'N/A')}/10 ({weights.get('price', 0):.0%} weight)")
        print(f"   Availability:    {winner.get('availability',   'N/A')} ({weights.get('availability', 0):.0%} weight)")
        print(f"\n   Price (INR):     ₹{winner.get('price_inr', 'N/A')}")
        print(f"   Reviews count:   {winner.get('reviews', 0)} ratings")
        print(f"   Why this one?    {winner.get('why', 'N/A')}")
        print(f"   Benefits:        {', '.join(winner.get('benefits', [])[:3])}")
        print(f"   Caveats:         {', '.join(winner.get('losses',   [])[:2])}")
        print(f"   Buy at:          {winner.get('url', 'N/A')}")
        print(f"   Confidence:      {winner.get('confidence', 0):.0%}")

        print(f"\n   📊 Top {min(10,len(ranked))} Ranked Products:")
        print(f"   {'#':<3} {'Product':<32} {'Score':>5}  {'Quality':>7}  {'PriceVal':>8}  {'Price(₹)':>9}  {'Avail'}")
        print(f"   {'─'*85}")
        for r in ranked[:10]:
            price_str = f"₹{int(r['price_inr'])}" if isinstance(r.get('price_inr'), (int, float)) and r['price_inr'] else "N/A"
            print(
                f"   #{r.get('rank','?'):<3} {r.get('name','?')[:32]:<32} "
                f"{str(r.get('score','?')):>5}  "
                f"{str(r.get('quality','?')):>7}  "
                f"{str(r.get('price_score','?')):>8}  "
                f"{price_str:>9}  "
                f"{r.get('availability','?')}"
            )
        print(f"{'─'*60}\n")
        return {
            "final_recommendation": rec,
            "agent_opinions": last_opinions,
            "mode": "discovery",
        }


if __name__ == "__main__":
    query = input("🔍 What are you looking for? ").strip()
    if query:
        result = find_best_product(query)
    else:
        print("No query entered.")