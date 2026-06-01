from backend.agents.state import Blackboard
from backend.utils.json_helpers import extract_price_value
from backend.integrations.amazon import fetch_price_by_search


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
                asin     = search_results.get("asin_map", {}).get(product, "")
                fallback = fetch_price_by_search(product, asin)
                fb_price = extract_price_value(fallback.get("price", ""))
                if fb_price > 0:
                    price_inr = fb_price
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

    # Price scoring: 100 * min_price / price (relative to cheapest)
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
