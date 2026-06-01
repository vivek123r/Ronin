from backend.agents.state import Blackboard
from backend.utils.llm import llm
from backend.utils.json_helpers import extract_json
from langchain_core.messages import HumanMessage, SystemMessage


def intent_classifier_node(state: Blackboard) -> dict:
    response = llm.invoke([
        SystemMessage(content=(
            "Classify a product query into one of two modes:\n"
            "- \"discovery\": user wants to find/recommend the best product\n"
            "- \"comparison\": user explicitly names 2+ specific products to compare\n"
            "Also extract budget information:\n"
            "- \"budget_type\": \"under\", \"around\", \"range\", or \"none\"\n"
            "- \"budget_min\": lower bound in INR (0 if not a range)\n"
            "- \"budget_max\": upper bound in INR (0 if no budget)\n"
            "- \"search_keyword\": 2-4 word clean product keyword for Amazon search\n"
            "Return ONLY raw JSON: {\"mode\": \"discovery\"|\"comparison\", \"products\": [], "
            "\"budget_type\": \"none\", \"budget_min\": 0, \"budget_max\": 0, \"search_keyword\": \"\"}"
        )),
        HumanMessage(content=f"Query: {state['query']}"),
    ])
    result         = extract_json(response.content)
    mode           = result.get("mode", "discovery")
    budget_type    = result.get("budget_type", "none") or "none"
    budget_min     = int(result.get("budget_min", 0) or 0)
    budget_max     = int(result.get("budget_max", 0) or 0)
    search_keyword = result.get("search_keyword", "").strip() or state["query"]
    products       = result.get("products", [])

    print(f"  🧭 Mode: {mode.upper()}" + (f" | Products: {products}" if products else ""))
    print(f"  🔑 Amazon keyword: {search_keyword}")
    if budget_type != "none" and budget_max > 0:
        print(f"  💰 Budget: {budget_type} ₹{budget_max:,}" + (f" (min ₹{budget_min:,})" if budget_min else ""))

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
