from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.agents.state import Blackboard
from backend.agents.review import review_agent_node
from backend.agents.price import price_agent_node


def parallel_agents_node(state: Blackboard) -> dict:
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
