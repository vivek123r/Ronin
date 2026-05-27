"""
Proper Multi-Agent Product Search
- Supervisor dynamically routes to agents based on what's missing
- Each agent runs a ReAct loop (reason → act → observe → repeat)
- Agents write opinions/findings to a shared blackboard
- Agents can request help from other agents via open_questions
- Supervisor decides when confidence is high enough to conclude
"""

import os, json, operator, re
from typing import TypedDict, Annotated, List, Dict, Any, Literal
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_community.tools.tavily_search import TavilySearchResults
from langgraph.graph import StateGraph, END, START

from dotenv import load_dotenv
load_dotenv()

llm = ChatOpenAI(
    model="openai/gpt-4o-mini",
    openai_api_base="https://openrouter.ai/api/v1",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    temperature=0,
)
search_tool = TavilySearchResults(max_results=5)


# ─────────────────────────────────────────────────────────────────────────────
# JSON EXTRACTION — robust parsing for LLM responses
# ─────────────────────────────────────────────────────────────────────────────

def extract_json(text: str) -> dict:
    """Robustly extract JSON from LLM response — handles markdown, extra text, etc."""
    
    # 1. Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass

    # 2. Strip markdown code blocks
    # Handles ```json ... ``` and ``` ... ```
    cleaned = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # 3. Find the outermost { ... } block
    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end+1])
        except Exception:
            pass

    # 4. Log exactly what we got so you can debug
    print(f"\n⚠️  JSON parse failed. Raw LLM output was:\n{'-'*40}\n{text}\n{'-'*40}")
    return {}


# ─────────────────────────────────────────────────────────────────────────────
# SHARED BLACKBOARD — agents READ and WRITE this, not just their own slice
# ─────────────────────────────────────────────────────────────────────────────

class Blackboard(TypedDict):
    query:              str
    # Each agent appends its findings — full history preserved
    raw_findings:       Annotated[List[dict], operator.add]
    # Each agent writes its current opinion; supervisor reads all
    agent_opinions:     Dict[str, Any]       # {"search": {...}, "review": {...}}
    # Agents post questions for other agents to answer
    open_questions:     Annotated[List[str], operator.add]
    answered_questions: Annotated[List[str], operator.add]
    # Confidence per agent (0-1); supervisor waits until all > threshold
    confidence:         Dict[str, float]
    # Supervisor state
    next_agent:         str                  # who supervisor is dispatching
    supervisor_notes:   Annotated[List[str], operator.add]
    iteration:          int
    final_recommendation: Dict[str, Any]


# ─────────────────────────────────────────────────────────────────────────────
# REACT LOOP HELPER — each agent uses this to reason+act until confident
# ─────────────────────────────────────────────────────────────────────────────

def react_loop(agent_name: str, system_prompt: str, state: Blackboard,
               max_steps: int = 3) -> tuple[dict, float]:
    """
    Runs a ReAct loop for an agent:
      Thought → Action (search/analyze) → Observation → repeat
    Returns (findings_dict, confidence_score)
    """
    # Enforce JSON-only responses
    system_prompt += "\n\nCRITICAL: Always respond with raw JSON only. No markdown, no backticks, no explanation."
    
    history = []
    findings = {}
    confidence = 0.0

    # Give agent full blackboard context
    context = {
        "query":          state["query"],
        "open_questions": state.get("open_questions", []),
        "other_agents":   state.get("agent_opinions", {}),
        "my_findings_so_far": findings,
    }

    for step in range(max_steps):
        thought_prompt = f"""
Blackboard context: {json.dumps(context)}
Step {step+1}/{max_steps}

Respond with ONLY raw JSON (no markdown, no backticks):
{{
  "thought": "what I know, what's missing, what I should do next",
  "action": "search" | "analyze" | "answer_question" | "done",
  "action_input": "search query OR data to analyze OR question being answered",
  "findings_update": {{...any new findings to add...}},
  "confidence": 0.0-1.0,
  "questions_for_others": ["optional questions for other agents"]
}}"""

        response = llm.invoke([
            SystemMessage(content=system_prompt),
            *history,
            HumanMessage(content=thought_prompt)
        ])

        # ✅ Robust extraction at every step
        step_result = extract_json(response.content)
        
        if not step_result:
            print(f"⚠️  [{agent_name}] step {step+1} parse failed — skipping step")
            continue

        history.append(AIMessage(content=response.content))

        # Execute the action
        observation = ""
        action = step_result.get("action", "done")

        if action == "search":
            raw = search_tool.invoke(step_result.get("action_input", state["query"]))
            observation = str(raw[:3])
        elif action == "analyze":
            observation = f"Analysis input received: {step_result.get('action_input','')}"
        elif action == "answer_question":
            observation = f"Answering: {step_result.get('action_input','')}"
        elif action == "done":
            findings.update(step_result.get("findings_update", {}))
            confidence = step_result.get("confidence", 0.5)
            break

        # Update findings and context after each step
        findings.update(step_result.get("findings_update", {}))
        confidence = step_result.get("confidence", 0.0)
        context["my_findings_so_far"] = findings
        context["last_observation"] = observation

        history.append(HumanMessage(content=f"Observation: {observation}"))

        # Early exit if confident enough
        if confidence >= 0.85:
            break

    return findings, confidence


# ─────────────────────────────────────────────────────────────────────────────
# SUPERVISOR — the real brain; decides who runs next based on blackboard state
# ─────────────────────────────────────────────────────────────────────────────

def supervisor_node(state: Blackboard) -> dict:
    """
    Reads the full blackboard and decides:
    - Which agent to call next
    - Whether we have enough to conclude
    - What gaps still exist
    """
    opinions   = state.get("agent_opinions", {})
    confidence = state.get("confidence", {})
    questions  = state.get("open_questions", [])
    iteration  = state.get("iteration", 0)

    system = SystemMessage(content="""You are a supervisor coordinating product research agents.
You decide who to call next based on what's missing or uncertain.
Agents available: search_agent, review_agent, price_agent, ranker_agent
Respond with JSON only:
{
  "reasoning": "what's been done, what's missing",
  "next_agent": "search_agent|review_agent|price_agent|ranker_agent|DONE",
  "instruction": "specific task for that agent",
  "ready_to_conclude": true|false
}""")

    human = HumanMessage(content=json.dumps({
        "query":            state["query"],
        "iteration":        iteration,
        "agent_opinions":   opinions,
        "confidence_scores": confidence,
        "open_questions":   questions,
        "findings_count":   len(state.get("raw_findings", [])),
    }))

    response = llm.invoke([system, human])

    try:
        decision = json.loads(response.content)
    except Exception:
        # Fallback: cycle through agents in order
        order = ["search_agent", "review_agent", "price_agent", "ranker_agent"]
        done_agents = list(opinions.keys())
        next_a = next((a for a in order if a not in done_agents), "ranker_agent")
        decision = {"next_agent": next_a, "reasoning": "fallback cycling",
                    "ready_to_conclude": len(done_agents) >= 3}

    return {
        "next_agent":       decision.get("next_agent", "ranker_agent"),
        "iteration":        iteration + 1,
        "supervisor_notes": [f"[Supervisor i{iteration}] → {decision.get('next_agent')} "
                             f"| {decision.get('reasoning','')[:80]}"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# SPECIALIZED AGENTS — each runs a ReAct loop, writes to blackboard
# ─────────────────────────────────────────────────────────────────────────────

def search_agent_node(state: Blackboard) -> dict:
    system = """You are a search specialist. Your job:
- Find real products matching the query
- Search multiple angles: reviews, alternatives, "best X" lists
- Note price ranges, top brands, and market landscape
- Post questions to open_questions if you need pricing or review data"""

    findings, confidence = react_loop("search_agent", system, state)

    # Merge into shared blackboard
    current_opinions = state.get("agent_opinions", {})
    current_confidence = state.get("confidence", {})

    return {
        "raw_findings":   [{"agent": "search_agent", "data": findings}],
        "agent_opinions": {**current_opinions,   "search_agent": findings},
        "confidence":     {**current_confidence, "search_agent": confidence},
        "open_questions": findings.get("questions_for_others", []),
        "supervisor_notes": [f"[Search Agent] confidence={confidence:.2f} | "
                             f"found={findings.get('product_count', '?')} products"],
    }


def review_agent_node(state: Blackboard) -> dict:
    system = """You are a review and sentiment analyst. Your job:
- Read what the search agent found (check agent_opinions.search_agent)
- Search for user reviews, expert ratings, Reddit discussions
- Score each product on: reliability, user satisfaction, common complaints
- Answer any open questions about review quality
- Flag if you need more product names from the search agent"""

    findings, confidence = react_loop("review_agent", system, state)

    current_opinions   = state.get("agent_opinions", {})
    current_confidence = state.get("confidence", {})

    return {
        "raw_findings":     [{"agent": "review_agent", "data": findings}],
        "agent_opinions":   {**current_opinions,   "review_agent": findings},
        "confidence":       {**current_confidence, "review_agent": confidence},
        "open_questions":   findings.get("questions_for_others", []),
        "answered_questions": findings.get("answers_provided", []),
        "supervisor_notes": [f"[Review Agent] confidence={confidence:.2f}"],
    }


def price_agent_node(state: Blackboard) -> dict:
    system = """You are a price and value analyst. Your job:
- Read what search + review agents found (check agent_opinions)
- Search for current prices, deals, retailer comparisons
- Calculate value scores: (quality / price) relative to alternatives
- Answer any open questions about pricing
- Flag if review scores are needed to compute true value"""

    findings, confidence = react_loop("price_agent", system, state)

    current_opinions   = state.get("agent_opinions", {})
    current_confidence = state.get("confidence", {})

    return {
        "raw_findings":     [{"agent": "price_agent", "data": findings}],
        "agent_opinions":   {**current_opinions,   "price_agent": findings},
        "confidence":       {**current_confidence, "price_agent": confidence},
        "open_questions":   findings.get("questions_for_others", []),
        "answered_questions": findings.get("answers_provided", []),
        "supervisor_notes": [f"[Price Agent] confidence={confidence:.2f}"],
    }


def ranker_agent_node(state: Blackboard) -> dict:
    """
    Final synthesis agent — reads ALL agent opinions from blackboard,
    debates tradeoffs, and produces a confident recommendation.
    """
    system = """You are the final synthesis and ranking agent.
You have access to ALL agent findings. Your job:
- Reconcile disagreements between agents
- Weight evidence by each agent's confidence score
- Consider open questions that weren't fully answered
- Produce a final ranked list with clear reasoning
- Give an overall confidence in your recommendation

YOU MUST respond with ONLY raw JSON — no markdown, no backticks, no explanation.
Exact format:
{
  "ranked": [{"rank": 1, "name": "...", "score": 85, "reasoning": "..."}],
  "winner": {
    "name": "...", "score": 90, "price": "...", "buy_at": "...",
    "why": "...", "caveats": "...", "confidence": 0.85
  },
  "synthesis_notes": "how you weighed conflicting data"
}"""

    payload = json.dumps({
        "query":           state["query"],
        "all_opinions":    state.get("agent_opinions", {}),
        "all_findings":    state.get("raw_findings", []),
        "confidence_map":  state.get("confidence", {}),
        "open_questions":  state.get("open_questions", []),
        "answered":        state.get("answered_questions", []),
    })

    response = llm.invoke([SystemMessage(content=system),
                           HumanMessage(content=payload)])

    # ✅ Use robust extractor instead of raw json.loads
    result = extract_json(response.content)

    # ✅ Fallback: build a minimal result from raw_findings if parse still fails
    if not result or "winner" not in result:
        print("⚠️  Ranker fallback — constructing result from raw findings")
        opinions = state.get("agent_opinions", {})
        search_data = opinions.get("search_agent", {})
        products = search_data.get("products", search_data.get("findings", []))
        
        result = {
            "ranked": [],
            "winner": {
                "name":       str(products[0]) if products else "Not found",
                "score":      50,
                "price":      opinions.get("price_agent", {}).get("best_price", "unknown"),
                "buy_at":     "Check retailer",
                "why":        "Best available match based on search results",
                "caveats":    "Limited data — manual verification recommended",
                "confidence": 0.3,
            },
            "synthesis_notes": "Fallback result due to LLM parse error",
        }

    current_opinions   = state.get("agent_opinions", {})
    current_confidence = state.get("confidence", {})

    return {
        "agent_opinions":       {**current_opinions,   "ranker": result},
        "confidence":           {**current_confidence, "ranker": result.get("winner", {}).get("confidence", 0.5)},
        "final_recommendation": result,
        "supervisor_notes":     [f"[Ranker] Winner: {result.get('winner',{}).get('name','?')} "
                                 f"| synthesis: {result.get('synthesis_notes','')[:60]}"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# ROUTING — supervisor's decision drives who runs next
# ─────────────────────────────────────────────────────────────────────────────

def route_from_supervisor(state: Blackboard) -> str:
    next_agent = state.get("next_agent", "DONE")
    iteration  = state.get("iteration", 0)

    # Hard stop after 8 iterations to prevent infinite loops
    if iteration >= 8 or next_agent == "DONE":
        return "ranker_agent"

    route_map = {
        "search_agent":  "search_agent",
        "review_agent":  "review_agent",
        "price_agent":   "price_agent",
        "ranker_agent":  "ranker_agent",
    }
    return route_map.get(next_agent, "ranker_agent")


# ─────────────────────────────────────────────────────────────────────────────
# GRAPH — supervisor is the hub; agents report back to it
# ─────────────────────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    g = StateGraph(Blackboard)

    g.add_node("supervisor",    supervisor_node)
    g.add_node("search_agent",  search_agent_node)
    g.add_node("review_agent",  review_agent_node)
    g.add_node("price_agent",   price_agent_node)
    g.add_node("ranker_agent",  ranker_agent_node)

    g.add_edge(START, "supervisor")

    # Supervisor dynamically routes to any agent
    g.add_conditional_edges(
        "supervisor", route_from_supervisor,
        {
            "search_agent": "search_agent",
            "review_agent": "review_agent",
            "price_agent":  "price_agent",
            "ranker_agent": "ranker_agent",
        }
    )

    # Every agent reports back to supervisor (hub-and-spoke)
    g.add_edge("search_agent", "supervisor")
    g.add_edge("review_agent", "supervisor")
    g.add_edge("price_agent",  "supervisor")

    # Ranker is terminal
    g.add_edge("ranker_agent", END)

    return g.compile()



# ─────────────────────────────────────────────────────────────────────────────
# RUNNER
# ─────────────────────────────────────────────────────────────────────────────

def find_best_product(query: str) -> dict:
    app = build_graph()
    print(app.get_graph().draw_ascii())

    initial: Blackboard = {
        "query":                query,
        "raw_findings":         [],
        "agent_opinions":       {},
        "open_questions":       [],
        "answered_questions":   [],
        "confidence":           {},
        "next_agent":           "",
        "supervisor_notes":     [],
        "iteration":            0,
        "final_recommendation": {},
    }

    print(f"\n🔍 Searching for: {query}\n{'─'*50}")

    # ✅ Stream ONLY — no second invoke call
    final = None
    for step in app.stream(initial, stream_mode="updates"):
        for node_name, output in step.items():
            notes = output.get("supervisor_notes", [])
            for note in notes:
                print(f"  {note}")
        final = step  # Capture latest state after each node

    # Final state already set from stream — use it directly
    final = final or {}
    winner = final.get("ranker_agent", {}).get("final_recommendation", {}).get("winner", {})
    ranked = final.get("ranker_agent", {}).get("final_recommendation", {}).get("ranked", [])

    print(f"\n{'─'*50}")
    print(f"✅  Winner:     {winner.get('name', 'Not found')}")
    print(f"    Score:     {winner.get('score', 'N/A')}/100")
    print(f"    Price:     {winner.get('price', 'N/A')}")
    print(f"    Buy at:    {winner.get('buy_at', 'N/A')}")
    print(f"    Why:       {winner.get('why', 'N/A')}")
    print(f"    Caveats:   {winner.get('caveats', 'N/A')}")
    print(f"    Confidence:{winner.get('confidence', 'N/A')}")
    print(f"\n  Full  ranking:")
    for r in ranked:
        print(f"    #{r.get('rank','?')} {r.get('name','?')} — {r.get('score','?')}/100")

    return winner


if __name__ == "__main__":
    result = find_best_product("best laptop under 1000 dollar")