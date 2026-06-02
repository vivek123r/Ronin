import re
import requests
from backend.utils.json_helpers import extract_json, extract_price_value
from backend.utils.llm import llm
from backend.utils.request_config import get
from langchain_core.messages import HumanMessage, SystemMessage


def _headers() -> dict:
    return {
        "x-rapidapi-key":  get("RAPIDAPI_KEY"),
        "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
    }


def search_amazon(keyword: str, params: dict = None) -> list:
    """Broad Amazon search. Returns list of raw product dicts."""
    p = {"query": keyword, "page": "1", "country": "IN", "sort_by": "RELEVANCE"}
    if params:
        p.update(params)
    try:
        resp = requests.get(
            "https://real-time-amazon-data.p.rapidapi.com/search",
            headers=_headers(), params=p, timeout=10,
        )
        return resp.json().get("data", {}).get("products", []) if resp.status_code == 200 else []
    except Exception as e:
        print(f"  ⚠️  Amazon search failed: {e}")
        return []


def get_product_details(asin: str, region: str = "IN") -> dict:
    """Fetch Amazon product details + reviews by ASIN."""
    try:
        resp = requests.get(
            "https://real-time-amazon-data.p.rapidapi.com/product-details",
            headers=_headers(),
            params={"asin": asin, "country": region},
            timeout=20,
        )
        if resp.status_code != 200:
            return {}

        d = resp.json().get("data", {})
        img_keys = [k for k in d if "photo" in k.lower() or "image" in k.lower() or "thumbnail" in k.lower()]
        if img_keys:
            print(f"  🖼  Amazon image keys: {img_keys} → {[d[k] for k in img_keys[:2]]}")

        reviews = d.get("top_reviews", []) or d.get("top_reviews_global", [])
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
            "asin":                asin,
            "product_title":       d.get("product_title", ""),
            "avg_rating":          d.get("product_star_rating"),
            "num_ratings":         d.get("product_num_ratings"),
            "rating_distribution": d.get("rating_distribution", {}),
            "reviews":             review_texts,
            "about_product":       d.get("about_product", []),
            "product_price":       d.get("product_price") or d.get("product_minimum_offer_price"),
            "product_url":         d.get("product_url", ""),
            "product_image_url": (
                d.get("product_photo")
                or d.get("product_main_image_url")
                or (d.get("product_photos") or [None])[0]
            ),
        }
    except Exception as e:
        print(f"  ⚠️  get_product_details failed: {e}")
        return {}


def fetch_price_by_search(title: str, asin: str = "") -> dict:
    """Fallback: search Amazon for price when product-details returned none."""
    try:
        resp = requests.get(
            "https://real-time-amazon-data.p.rapidapi.com/search",
            headers=_headers(),
            params={"query": title[:80], "page": "1", "country": "IN"},
            timeout=15,
        )
        if resp.status_code == 200:
            prods = resp.json().get("data", {}).get("products", [])
            for p in prods[:5]:
                if asin and p.get("asin") == asin:
                    price = p.get("product_price") or p.get("product_minimum_offer_price", "")
                    if price:
                        return {"price": price}
            for p in prods[:5]:
                price = p.get("product_price") or p.get("product_minimum_offer_price", "")
                if price:
                    return {"price": price}
    except Exception as e:
        print(f"  ⚠️  Price fallback search failed: {e}")
    return {}


def extract_asin_from_url(url: str) -> str:
    match = re.search(r'/(?:dp|gp/product)/([A-Z0-9]{10})', url)
    return match.group(1) if match else ""


def resolve_product_name(name: str) -> tuple:
    """Search Amazon for name, use LLM to pick the best-matching result. Returns (title, asin)."""
    try:
        prods = search_amazon(name)[:5]
        if not prods:
            return name, ""

        candidates = [
            {"index": i, "title": p.get("product_title", ""), "asin": p.get("asin", "")}
            for i, p in enumerate(prods)
        ]

        pick = llm.invoke([
            SystemMessage(
                "Pick the Amazon product that best matches what the user asked for. "
                "Consider exact model name, generation, and variant. "
                "Return ONLY raw JSON: {\"index\": 0}"
            ),
            HumanMessage(f"User wants: \"{name}\"\n\nCandidates:\n{candidates}"),
        ])
        import json
        idx  = extract_json(pick.content).get("index", 0)
        best = candidates[min(int(idx), len(candidates) - 1)]

        validation = llm.invoke([
            SystemMessage(
                "You are a product match validator. "
                "Decide if the resolved Amazon product is genuinely the same product the user asked for. "
                "Be strict about model numbers and generations. "
                "Return ONLY raw JSON: {\"match\": true|false, \"reason\": \"short explanation\"}"
            ),
            HumanMessage(
                f"User asked for: \"{name}\"\n"
                f"Amazon resolved to: \"{best['title']}\"\n"
                "Is this the correct product?"
            ),
        ])
        val = extract_json(validation.content)
        if val.get("match") is False:
            print(f"  ⚠️  LLM validation failed for '{name}': {val.get('reason', '')}")
            return name, ""

        return best["title"], best["asin"]
    except Exception as e:
        print(f"  ⚠️  resolve_product_name failed for \"{name}\": {e}")
        return name, ""
