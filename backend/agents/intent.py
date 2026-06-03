from backend.agents.state import Blackboard
from backend.utils.llm import llm
from backend.utils.json_helpers import extract_json
from langchain_core.messages import HumanMessage, SystemMessage


def intent_classifier_node(state: Blackboard) -> dict:
    query = state["query"]

    # Explicit prefixes from frontend modes — skip LLM entirely
    if query.startswith("FIND:"):
        asin = query[5:].strip()
        print(f"  [Mode] FIND | ASIN: {asin}")
        return {
            "mode": "comparison",
            "comparison_products": [asin],
            "budget_type": "none", "budget_min": 0, "budget_max": 0,
            "search_keyword": asin,
        }

    if query.startswith("COMPARE:"):
        asins = [a.strip() for a in query[8:].split(",") if a.strip()]
        print(f"  [Mode] COMPARE | ASINs: {asins}")
        return {
            "mode": "comparison",
            "comparison_products": asins,
            "budget_type": "none", "budget_min": 0, "budget_max": 0,
            "search_keyword": "",
        }

    # Research mode — LLM classifies, but also detects if user should switch mode
    response = llm.invoke([
        SystemMessage(content=(
            "Classify a product query. Return ONLY raw JSON:\n"
            "{\n"
            "  \"mode\": \"discovery\",\n"
            "  \"wrong_mode\": null,\n"
            "  \"products\": [],\n"
            "  \"budget_type\": \"none\",\n"
            "  \"budget_min\": 0,\n"
            "  \"budget_max\": 0,\n"
            "  \"search_keyword\": \"\"\n"
            "}\n\n"
            "Rules:\n"
            "- mode is always \"discovery\" (research mode is for open-ended queries only)\n"
            "- If the query is comparing 2+ named products (e.g. 'iPhone 16 vs Samsung S25'), set wrong_mode to \"compare\" and explain briefly\n"
            "- If the query is pasting an Amazon URL or asking about a single specific product by URL, set wrong_mode to \"find\" and explain briefly\n"
            "- Otherwise wrong_mode is null\n"
            "- budget_type: \"under\", \"around\", \"range\", or \"none\"\n"
            "- search_keyword: 2-4 word clean Amazon search keyword"
        )),
        HumanMessage(content=f"Query: {query}"),
    ])
    result         = extract_json(response.content)
    wrong_mode     = result.get("wrong_mode")
    if wrong_mode:
        suggestion = "compare" if wrong_mode == "compare" else "find"
        msg = result.get("wrong_mode_reason") or (
            "Switch to COMPARE mode and paste product URLs." if suggestion == "compare"
            else "Switch to FIND mode and paste the product URL."
        )
        print(f"  [Mode hint] Use {suggestion.upper()} mode instead: {msg}")
        raise ValueError(f"WRONG_MODE:{suggestion}:{msg}")
    mode           = "discovery"
    budget_type    = result.get("budget_type", "none") or "none"
    budget_min     = int(result.get("budget_min", 0) or 0)
    budget_max     = int(result.get("budget_max", 0) or 0)
    search_keyword = result.get("search_keyword", "").strip() or query
    products       = result.get("products", [])

    print(f"  [Mode] {mode.upper()}" + (f" | Products: {products}" if products else ""))
    print(f"  [Keyword] {search_keyword}")
    if budget_type != "none" and budget_max > 0:
        print(f"  [Budget] {budget_type} Rs{budget_max:,}" + (f" (min Rs{budget_min:,})" if budget_min else ""))

    return {
        "mode": mode,
        "comparison_products": products,
        "budget_type":   budget_type,
        "budget_min":    budget_min,
        "budget_max":    budget_max,
        "search_keyword": search_keyword,
    }


def route_from_classifier(state: Blackboard) -> str:
    return "comparison_search_agent" if state.get("mode") == "comparison" else "search_agent"
