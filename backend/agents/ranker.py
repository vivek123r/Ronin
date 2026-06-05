import time

from backend.agents.state import Blackboard
from backend.utils.llm import llm
from backend.utils.json_helpers import extract_json
from langchain_core.messages import HumanMessage, SystemMessage


def _get_image(name: str, product_cache: dict):
    if name in product_cache:
        return product_cache[name].get("product_image_url")
    lower = name.lower()
    for k, v in product_cache.items():
        if k.lower()[:30] in lower or lower[:30] in k.lower():
            return v.get("product_image_url")
    return None


def ranker_agent_node(state: Blackboard) -> dict:
    time.sleep(2)

    opinions      = state.get("agent_opinions", {})
    review_data   = opinions.get("review_agent", {}).get("products_analyzed", {})
    price_data    = opinions.get("price_agent",  {}).get("products_analyzed", {})
    product_cache = opinions.get("search_agent", {}).get("product_cache", {})
    query         = state["query"]

    llm.invoke([
        SystemMessage(content=(
            "You assign product ranking weights based on what a query implies. "
            "Return ONLY raw JSON: {\"quality\": 0.8, \"price\": 0.1, \"availability\": 0.1}"
        )),
        HumanMessage(content=f"Query: \"{query}\""),
    ])

    q_w, p_w, a_w = 0.8, 0.1, 0.1
    print(f"  [Ranker] Weights — quality:{q_w:.0%} price:{p_w:.0%} availability:{a_w:.0%}")

    ranked_products = []

    for product_name in set(list(review_data.keys()) + list(price_data.keys())):
        rd = review_data.get(product_name, {})
        pd = price_data.get(product_name, {})

        quality_score      = float(rd.get("rating", 0) or 0)
        price_score        = min(float(pd.get("price_score", 0) or 0) * 10, 100.0)
        availability_score = 100.0 if pd.get("availability", False) else 0.0

        review_conf = float(rd.get("confidence", 1.0) or 1.0)
        if review_conf < 0.5:
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

    result = {
        "ranked": [
            {
                "rank":              i + 1,
                "name":              p["name"],
                "score":             round(p["combined_score"], 1),
                "quality":           round(p["quality_score"], 1),
                "price_score":       round(p["price_score"], 1),
                "price_inr":         p["price_data"].get("price_inr", "N/A"),
                "availability":      "In Stock" if p["price_data"].get("availability") else "N/A",
                "url":               p["price_data"].get("url", "N/A"),
                "product_image_url": _get_image(p["name"], product_cache),
                "category_scores":   p["review_data"].get("category_scores", {}),
                "benefits":          p["review_data"].get("benefits", []),
                "losses":            p["review_data"].get("losses", []),
                "sentiment":         p["review_data"].get("sentiment", "neutral"),
                "confidence":        p["review_data"].get("confidence", 0.3),
                "_sources":          p["review_data"].get("_sources", {}),
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
                f"Query intent weights -- quality:{q_w:.0%} x price:{p_w:.0%} x availability:{a_w:.0%}. "
                f"Score: {winner['quality_score']:.0f}x{winner['eff_weights']['quality']:.2f} + "
                f"{winner['price_score']:.0f}x{winner['eff_weights']['price']:.2f} + "
                f"{winner['availability_score']:.0f}x{winner['eff_weights']['availability']:.2f} = "
                f"{winner['combined_score']:.1f}/100"
            ) if winner else "No products found",
            "benefits":          winner["review_data"].get("benefits", []) if winner else [],
            "losses":            winner["review_data"].get("losses",   []) if winner else [],
            "confidence":        min(0.95, winner["combined_score"] / 100) if winner else 0.1,
            "product_image_url": _get_image(winner["name"], product_cache) if winner else None,
            "category_scores":   winner["review_data"].get("category_scores", {}) if winner else {},
            "_sources":          winner["review_data"].get("_sources", {}) if winner else {},
        },
        "weights_used":    {"quality": q_w, "price": p_w, "availability": a_w},
        "methodology":     "Fixed weights: quality 80%, price 10%, availability 10%",
        "synthesis_notes": f"Evaluated {len(ranked_products)} products",
    }

    return {
        "agent_opinions":       {**state.get("agent_opinions", {}), "ranker": result},
        "confidence":           {**state.get("confidence", {}), "ranker": result["winner"]["confidence"]},
        "final_recommendation": result,
        "notes":                [f"[Ranker] Winner: {result['winner']['name']} | score: {result['winner']['combined_score']}/100"],
    }


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
            "name":            product,
            "quality":         float(rd.get("rating", 50) or 50),
            "price_inr":       pd.get("price_inr", 0),
            "price_score":     float(pd.get("price_score", 0) or 0),
            "availability":    "In Stock" if pd.get("availability") else "N/A",
            "url":             pd.get("url", ""),
            "benefits":        rd.get("benefits", []),
            "losses":          rd.get("losses", []),
            "sentiment":       rd.get("sentiment", "neutral"),
            "highlights":      rd.get("review_highlights", []),
            "confidence":      rd.get("confidence", 0.3),
            "category_scores":   rd.get("category_scores", {}),
            "_sources":          rd.get("_sources", {}),
            "product_image_url": _get_image(product, opinions.get("search_agent", {}).get("product_cache", {})),
        })

    comparison_table.sort(key=lambda x: x["quality"], reverse=True)

    verdict_resp = llm.invoke([
        SystemMessage(content=(
            "You are a product comparison expert. Given product scores and review highlights, "
            "write a concise verdict in 3-5 sentences explaining who should buy each product. "
            "Be specific about use cases. Return ONLY raw JSON: "
            "{\"verdict\": \"...\", \"best_value\": \"product name\", \"best_performance\": \"product name\"}"
        )),
        HumanMessage(content=(
            f"Query: {query}\n\n"
            f"Products:\n{[{k: v for k, v in p.items() if k != 'url'} for p in comparison_table]}"
        )),
    ])
    verdict_data = extract_json(verdict_resp.content)

    result = {
        "mode":             "comparison",
        "comparison_table": comparison_table,
        "verdict":          verdict_data.get("verdict", "See comparison table above."),
        "best_value":       verdict_data.get("best_value", ""),
        "best_performance": verdict_data.get("best_performance", ""),
    }

    return {
        "agent_opinions":       {**state.get("agent_opinions", {}), "comparison_ranker": result},
        "confidence":           {**state.get("confidence", {}), "comparison_ranker": 0.9},
        "final_recommendation": result,
        "notes":                [f"[Comparison Ranker] {len(comparison_table)} products compared"],
    }
