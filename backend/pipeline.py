"""
RONIN — Multi-Agent Product Research Pipeline

Graph flow:
  intent_classifier
    ├─ discovery  → search_agent → human_loop → parallel_agents → ranker_agent
    └─ comparison → comparison_search_agent → parallel_agents → comparison_ranker
"""

import json
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

from dotenv import load_dotenv
load_dotenv()

from langgraph.graph import StateGraph, END, START

from backend.agents.state import Blackboard
from backend.agents.intent import intent_classifier_node, route_from_classifier
from backend.agents.search import (
    search_agent_node, human_loop_node, comparison_search_agent_node
)
from backend.agents.parallel import parallel_agents_node
from backend.agents.ranker import ranker_agent_node, comparison_ranker_node


def route_after_parallel(state: Blackboard) -> str:
    return "comparison_ranker" if state.get("mode") in ("comparison", "find") else "ranker_agent"


def build_graph() -> StateGraph:
    g = StateGraph(Blackboard)

    g.add_node("intent_classifier",       intent_classifier_node)
    g.add_node("search_agent",            search_agent_node)
    g.add_node("human_loop",              human_loop_node)
    g.add_node("comparison_search_agent", comparison_search_agent_node)
    g.add_node("parallel_agents",         parallel_agents_node)
    g.add_node("ranker_agent",            ranker_agent_node)
    g.add_node("comparison_ranker",       comparison_ranker_node)

    g.add_edge(START, "intent_classifier")
    g.add_conditional_edges(
        "intent_classifier", route_from_classifier,
        {"search_agent": "search_agent", "comparison_search_agent": "comparison_search_agent"},
    )
    g.add_edge("search_agent",            "human_loop")
    g.add_edge("human_loop",              "parallel_agents")
    g.add_edge("comparison_search_agent", "parallel_agents")
    g.add_conditional_edges(
        "parallel_agents", route_after_parallel,
        {"ranker_agent": "ranker_agent", "comparison_ranker": "comparison_ranker"},
    )
    g.add_edge("ranker_agent",      END)
    g.add_edge("comparison_ranker", END)

    return g.compile()


def find_best_product(query: str) -> dict:
    app = build_graph()

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

    final        = None
    last_opinions = {}
    for step in app.stream(initial, stream_mode="updates"):
        for node_name, output in step.items():
            for note in output.get("notes", []):
                print(f"  {note}")
            if "agent_opinions" in output:
                last_opinions.update(output["agent_opinions"])
        final = step

    final = final or {}

    rec  = (
        final.get("comparison_ranker", {}).get("final_recommendation")
        or final.get("ranker_agent", {}).get("final_recommendation")
        or {}
    )
    mode = rec.get("mode", "discovery")

    print(f"\n{'─'*60}")

    if mode == "comparison":
        table   = rec.get("comparison_table", [])
        verdict = rec.get("verdict", "")
        print(f"📊 COMPARISON RESULTS ({len(table)} products)\n")
        for p in table:
            price_str = f"₹{int(p['price_inr'])}" if isinstance(p.get('price_inr'), (int, float)) and p['price_inr'] else "N/A"
            print(f"   {p['name'][:35]:<35} quality:{p['quality']:.0f}  ₹{price_str}  {p['availability']}")
        print(f"\n   🏅 Best Value:       {rec.get('best_value', 'N/A')}")
        print(f"   🚀 Best Performance: {rec.get('best_performance', 'N/A')}")
        print(f"\n   📝 Verdict:\n   {verdict}\n")
        return {"final_recommendation": rec, "agent_opinions": last_opinions, "mode": "comparison"}

    else:
        winner  = rec.get("winner", {})
        ranked  = rec.get("ranked", [])
        weights = rec.get("weights_used", {})
        print(f"🏆 WINNER: {winner.get('name', 'Not found')}")
        print(f"   Score: {winner.get('combined_score', 'N/A')}/100  |  ₹{winner.get('price_inr', 'N/A')}")
        print(f"   Why: {winner.get('why', 'N/A')}\n")
        for r in ranked[:10]:
            price_str = f"₹{int(r['price_inr'])}" if isinstance(r.get('price_inr'), (int, float)) and r['price_inr'] else "N/A"
            print(f"   #{r.get('rank','?'):<3} {r.get('name','?')[:40]:<40} score:{r.get('score','?')}  {price_str}")
        print(f"{'─'*60}\n")
        return {"final_recommendation": rec, "agent_opinions": last_opinions, "mode": "discovery"}


if __name__ == "__main__":
    query = input("🔍 What are you looking for? ").strip()
    if query:
        find_best_product(query)
    else:
        print("No query entered.")
