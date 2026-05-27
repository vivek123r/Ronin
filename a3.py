"""
Proper Multi-Agent Product Search
- Supervisor dynamically routes to agents based on what's missing
- Each agent runs a ReAct loop (reason → act → observe → repeat)
- Agents write opinions/findings to a shared blackboard
- Agents can request help from other agents via open_questions
- Supervisor decides when confidence is high enough to conclude
"""

import os, json, operator, re
from typing import TypedDict, Annotated, List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END, START
import requests
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

from dotenv import load_dotenv
load_dotenv()

llm = ChatOpenAI(
    model="openai/gpt-4o-mini",
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
    """Search YouTube for product reviews and fetch their transcripts"""
    from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
    videos = []
    try:
        url = "https://youtube138.p.rapidapi.com/search/"
        headers = {
            "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
            "x-rapidapi-host": "youtube138.p.rapidapi.com"
        }
        params = {"q": f"{query} review", "hl": "en", "gl": "US"}
        response = requests.get(url, headers=headers, params=params, timeout=5)
        if response.status_code != 200:
            print(f"⚠️  YouTube search HTTP {response.status_code}")
            return []

        contents = response.json().get("contents", [])
        for item in contents:
            video = item.get("video", item)
            vid_id  = video.get("videoId")
            title   = video.get("title", "")
            channel = video.get("channelTitle") or (video.get("author") or {}).get("title", "")
            if not vid_id:
                continue

            transcript_text = ""
            try:
                raw = YouTubeTranscriptApi.get_transcript(vid_id, languages=["en", "en-US", "en-GB"])
                snippet = raw[:120]
                transcript_text = " ".join(seg["text"] for seg in snippet)
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
            if len(videos) >= max_results:
                break

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
            timeout=10,
        )
        if detail_resp.status_code != 200:
            return {}

        detail_data = detail_resp.json().get("data", {})
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
        }
    except Exception as e:
        print(f"⚠️  get_amazon_reviews_by_asin failed: {e}")
        return {}


def get_amazon_reviews(product_name: str, region: str = "IN") -> dict:
    """Fetch Amazon reviews by product name (fallback when ASIN is unknown)"""
    try:
        headers = {
            "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
            "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
        }
        search_resp = requests.get(
            "https://real-time-amazon-data.p.rapidapi.com/search",
            headers=headers,
            params={"query": product_name, "page": "1", "country": region},
            timeout=10,
        )
        if search_resp.status_code != 200:
            return {}

        products = search_resp.json().get("data", {}).get("products", [])
        if not products:
            return {}

        asin = products[0].get("asin")
        if not asin:
            return {}

        return get_amazon_reviews_by_asin(asin, region)

    except Exception as e:
        print(f"⚠️  Amazon reviews fetch failed: {e}")
    return {}


def search_amazon_price(product_name: str, region: str = "IN") -> dict:
    """Search Amazon prices using RapidAPI Real-Time Amazon Data"""
    try:
        headers = {
            "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
            "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
        }
        response = requests.get(
            "https://real-time-amazon-data.p.rapidapi.com/search",
            headers=headers,
            params={"query": product_name, "page": "1", "country": region},
            timeout=10,
        )
        if response.status_code == 200:
            products = response.json().get("data", {}).get("products", [])[:1]
            if products:
                p = products[0]
                return {
                    "name":      p.get("product_title"),
                    "price":     p.get("product_price"),
                    "rating":    p.get("product_star_rating"),
                    "reviews":   p.get("product_num_ratings"),
                    "url":       p.get("product_url"),
                    "available": p.get("product_minimum_offer_price") is not None,
                }
    except Exception as e:
        print(f"⚠️  Amazon price search failed: {e}")
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


# ─────────────────────────────────────────────────────────────────────────────
# SHARED BLACKBOARD
# ─────────────────────────────────────────────────────────────────────────────

class Blackboard(TypedDict):
    query:                str
    raw_findings:         Annotated[List[dict], operator.add]
    agent_opinions:       Dict[str, Any]
    open_questions:       Annotated[List[str], operator.add]
    answered_questions:   Annotated[List[str], operator.add]
    confidence:           Dict[str, float]
    next_agent:           str
    supervisor_notes:     Annotated[List[str], operator.add]
    iteration:            int
    final_recommendation: Dict[str, Any]


# ─────────────────────────────────────────────────────────────────────────────
# REACT LOOP HELPER — used by review_agent for analyze / done actions
# ─────────────────────────────────────────────────────────────────────────────

def react_loop(agent_name: str, system_prompt: str, state: Blackboard,
               max_steps: int = 3) -> tuple[dict, float]:
    system_prompt += "\n\nCRITICAL: Always respond with raw JSON only. No markdown, no backticks, no explanation."

    history  = []
    findings = {}
    confidence = 0.0

    context = {
        "query":              state["query"],
        "open_questions":     state.get("open_questions", []),
        "other_agents":       state.get("agent_opinions", {}),
        "my_findings_so_far": findings,
    }

    for step in range(max_steps):
        thought_prompt = f"""
Blackboard context: {json.dumps(context)}
Step {step+1}/{max_steps}

Respond with ONLY raw JSON (no markdown, no backticks):
{{
  "thought": "what I know, what's missing, what I should do next",
  "action": "analyze" | "answer_question" | "done",
  "action_input": "data to analyze OR question being answered",
  "findings_update": {{...any new findings to add...}},
  "confidence": 0.0-1.0,
  "questions_for_others": ["optional questions for other agents"]
}}"""

        response = llm.invoke([
            SystemMessage(content=system_prompt),
            *history,
            HumanMessage(content=thought_prompt),
        ])

        step_result = extract_json(response.content)
        if not step_result:
            print(f"⚠️  [{agent_name}] step {step+1} parse failed — skipping step")
            continue

        history.append(AIMessage(content=response.content))

        action = step_result.get("action", "done")
        observation = ""

        if action == "analyze":
            observation = f"Analysis input received: {step_result.get('action_input','')}"
        elif action == "answer_question":
            observation = f"Answering: {step_result.get('action_input','')}"
        elif action == "done":
            findings.update(step_result.get("findings_update", {}))
            confidence = step_result.get("confidence", 0.5)
            break

        findings.update(step_result.get("findings_update", {}))
        confidence = step_result.get("confidence", 0.0)
        context["my_findings_so_far"] = findings
        context["last_observation"]   = observation

        history.append(HumanMessage(content=f"Observation: {observation}"))

        if confidence >= 0.85:
            break

    return findings, confidence


# ─────────────────────────────────────────────────────────────────────────────
# SUPERVISOR
# ─────────────────────────────────────────────────────────────────────────────

def supervisor_node(state: Blackboard) -> dict:
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
        "query":             state["query"],
        "iteration":         iteration,
        "agent_opinions":    opinions,
        "confidence_scores": confidence,
        "open_questions":    questions,
        "findings_count":    len(state.get("raw_findings", [])),
    }))

    response = llm.invoke([system, human])

    try:
        decision = json.loads(response.content)
    except Exception:
        order      = ["search_agent", "review_agent", "price_agent", "ranker_agent"]
        done_agents = list(opinions.keys())
        next_a     = next((a for a in order if a not in done_agents), "ranker_agent")
        decision   = {"next_agent": next_a, "reasoning": "fallback cycling",
                      "ready_to_conclude": len(done_agents) >= 3}

    return {
        "next_agent":       decision.get("next_agent", "ranker_agent"),
        "iteration":        iteration + 1,
        "supervisor_notes": [f"[Supervisor i{iteration}] → {decision.get('next_agent')} "
                             f"| {decision.get('reasoning','')[:80]}"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# SEARCH AGENT — uses Amazon search directly, no Tavily
# ─────────────────────────────────────────────────────────────────────────────

def search_agent_node(state: Blackboard) -> dict:
    """
    Finds candidate products by:
      a) Querying Amazon search for the user's query (gets real titles + ASINs)
      b) Asking the LLM to pick the most relevant 5 from those results
    """
    query = state["query"]
    print(f"  🔎 Searching Amazon for: {query}")

    # Step 1: pull raw Amazon search results
    try:
        headers = {
            "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
            "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
        }
        resp = requests.get(
            "https://real-time-amazon-data.p.rapidapi.com/search",
            headers=headers,
            params={"query": query, "page": "1", "country": "IN", "sort_by": "RELEVANCE"},
            timeout=10,
        )
        raw_products = resp.json().get("data", {}).get("products", []) if resp.status_code == 200 else []
    except Exception as e:
        print(f"  ⚠️  Amazon search failed: {e}")
        raw_products = []

    raw_products = raw_products[:15]

    candidates = [
        {
            "title":   p.get("product_title", ""),
            "asin":    p.get("asin", ""),
            "price":   p.get("product_price") or p.get("product_minimum_offer_price", ""),
            "rating":  p.get("product_star_rating", ""),
            "reviews": p.get("product_num_ratings", ""),
        }
        for p in raw_products
        if p.get("product_title")
    ]

    # Step 2: LLM picks the 5 most relevant, distinct products
    system = (
        "You are a product selection assistant. "
        "Given a list of Amazon search results and the user's original query, "
        "pick the 5 most relevant, distinct products (no duplicates / variants). "
        "Return ONLY raw JSON — no markdown, no backticks:\n"
        '{"products": ["Exact Product Title 1", "Exact Product Title 2", ...]}'
    )
    human_content = (
        f"Query: {query}\n\n"
        f"Amazon results:\n{json.dumps(candidates, indent=2)}\n\n"
        "Return the 5 best matching products as a JSON list of their exact titles."
    )

    response = llm.invoke([
        SystemMessage(content=system),
        HumanMessage(content=human_content),
    ])

    parsed   = extract_json(response.content)
    products = parsed.get("products", [p["title"] for p in candidates[:5]])

    # Step 3: build ASIN map for downstream agents
    asin_map = {p["title"]: p["asin"] for p in candidates if p["asin"]}

    formatted_findings = {
        "products":      products,
        "product_count": len(products),
        "asin_map":      asin_map,
        "confidence":    0.9 if products else 0.1,
    }

    current_opinions   = state.get("agent_opinions", {})
    current_confidence = state.get("confidence", {})

    print(f"  ✅ Found {len(products)} products via Amazon search")

    return {
        "raw_findings":     [{"agent": "search_agent", "data": formatted_findings}],
        "agent_opinions":   {**current_opinions,   "search_agent": formatted_findings},
        "confidence":       {**current_confidence, "search_agent": formatted_findings["confidence"]},
        "supervisor_notes": [f"[Search Agent] Found {len(products)} products via Amazon | confidence=0.90"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# HUMAN LOOP — user confirms/modifies product list; additions validated via Amazon
# ─────────────────────────────────────────────────────────────────────────────

def human_loop_node(state: Blackboard) -> dict:
    search_results = state.get("agent_opinions", {}).get("search_agent", {})
    products       = list(search_results.get("products", []))
    asin_map       = dict(search_results.get("asin_map", {}))

    if not products:
        print("⚠️  No products to confirm")
        return {
            "agent_opinions":   state.get("agent_opinions", {}),
            "supervisor_notes": ["[Human Loop] No products found"],
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
                try:
                    headers = {
                        "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
                        "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
                    }
                    resp = requests.get(
                        "https://real-time-amazon-data.p.rapidapi.com/search",
                        headers=headers,
                        params={"query": name, "page": "1", "country": "IN"},
                        timeout=10,
                    )
                    amz_products = (
                        resp.json().get("data", {}).get("products", [])
                        if resp.status_code == 200 else []
                    )
                except Exception as e:
                    print(f"  ⚠️  Amazon lookup failed for \"{name}\": {e}")
                    amz_products = []

                if amz_products:
                    best          = amz_products[0]
                    resolved_title = best.get("product_title", name)
                    resolved_asin  = best.get("asin", "")
                    products.append(resolved_title)
                    if resolved_asin:
                        asin_map[resolved_title] = resolved_asin
                    print(f"  ✅ Resolved to: \"{resolved_title}\" (ASIN: {resolved_asin or 'n/a'})")
                else:
                    products.append(name)
                    print(f"  ⚠️  Not found on Amazon — adding as-is: \"{name}\"")

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

    updated_search   = {**search_results, "products": products, "asin_map": asin_map}
    updated_opinions = {**state.get("agent_opinions", {}), "search_agent": updated_search}

    return {
        "agent_opinions":   updated_opinions,
        "supervisor_notes": [f"[Human Loop] Confirmed {len(products)} products for analysis"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# REVIEW AGENT
# ─────────────────────────────────────────────────────────────────────────────

def review_agent_node(state: Blackboard) -> dict:
    system = """You are a review and sentiment analyst. Your job:
- Analyse real Amazon customer reviews and YouTube video transcripts
- Score each product 0-100 based on what real users and reviewers actually said
- Extract concrete benefits and losses from the review text
- Weight verified Amazon purchases heavily; treat YouTube transcripts as expert opinion
- Be specific — quote or paraphrase actual review content where possible

Output JSON:
{
  "products_analyzed": {
    "product_name": {
      "rating": 85,
      "benefits": ["benefit1", "benefit2"],
      "losses": ["loss1", "loss2"],
      "sentiment": "positive/neutral/negative",
      "confidence": 0.85,
      "review_highlights": ["key quote 1", "key quote 2"]
    }
  },
  "questions_for_others": [],
  "answers_provided": []
}"""

    search_results = state.get("agent_opinions", {}).get("search_agent", {})
    products       = search_results.get("products", [])
    asin_map       = search_results.get("asin_map", {})

    if not products:
        print("⚠️  [Review Agent] No products from search agent")
        return {
            "agent_opinions": {**state.get("agent_opinions", {}), "review_agent": {}},
            "confidence":     {**state.get("confidence", {}),     "review_agent": 0.0},
            "supervisor_notes": ["[Review Agent] No products to review"],
        }

    findings = {"products_analyzed": {}}

    for product in products[:5]:
        print(f"  📺 Reviewing: {product}")

        yt_results     = search_youtube(product, max_results=2)

        # Use ASIN directly if we have it, else fall back to name search
        asin = asin_map.get(product)
        amazon_reviews = get_amazon_reviews_by_asin(asin) if asin else get_amazon_reviews(product)

        yt_section = ""
        for v in yt_results:
            transcript_snippet = v["transcript"][:1500] if v["transcript"] else "[none]"
            yt_section += f"\n### YouTube: {v['title']} ({v['channel']})\nTranscript excerpt:\n{transcript_snippet}\n"

        amz_section = ""
        if amazon_reviews:
            amz_section = (
                f"\n### Amazon  ({amazon_reviews.get('avg_rating','?')}⭐, "
                f"{amazon_reviews.get('num_ratings','?')} ratings)\n"
                f"Rating distribution: {amazon_reviews.get('rating_distribution', {})}\n"
            )
            for r in amazon_reviews.get("reviews", []):
                verified_tag = "✅ Verified" if r["verified"] else "Unverified"
                amz_section += f"- [{r['stars']}★ {verified_tag}] {r['title']}: {r['body'][:300]}\n"

        synthesis_prompt = f"""
Product: {product}

{yt_section if yt_section else "No YouTube transcripts found."}

{amz_section if amz_section else "No Amazon reviews found."}

Based on the real review data above, return ONLY raw JSON:
{{
  "rating": 0-100,
  "benefits": ["..."],
  "losses": ["..."],
  "sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0,
  "review_highlights": ["key quote or paraphrase 1", "key quote 2"]
}}"""

        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=synthesis_prompt),
        ])

        result = extract_json(response.content)
        if result:
            findings["products_analyzed"][product] = result
            print(f"     ✅ Rating: {result.get('rating', '?')}/100  |  "
                  f"YT videos: {len(yt_results)}  |  "
                  f"Amazon reviews: {len(amazon_reviews.get('reviews', []))}")
        else:
            print(f"     ❌ Could not parse review for {product}")

    current_opinions   = state.get("agent_opinions", {})
    current_confidence = state.get("confidence", {})
    avg_confidence     = (
        sum(v.get("confidence", 0) for v in findings["products_analyzed"].values())
        / max(len(findings["products_analyzed"]), 1)
    )

    return {
        "raw_findings":     [{"agent": "review_agent", "data": findings}],
        "agent_opinions":   {**current_opinions,   "review_agent": findings},
        "confidence":       {**current_confidence, "review_agent": avg_confidence},
        "supervisor_notes": [f"[Review Agent] Analysed {len(findings['products_analyzed'])} products | confidence={avg_confidence:.2f}"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# PRICE AGENT
# ─────────────────────────────────────────────────────────────────────────────

def price_agent_node(state: Blackboard) -> dict:
    search_results = state.get("agent_opinions", {}).get("search_agent", {})
    products       = search_results.get("products", [])
    asin_map       = search_results.get("asin_map", {})

    if not products:
        print("⚠️  [Price Agent] No products from search agent")
        return {
            "agent_opinions": {**state.get("agent_opinions", {}), "price_agent": {}},
            "confidence":     {**state.get("confidence", {}),     "price_agent": 0.0},
            "supervisor_notes": ["[Price Agent] No products to price"],
        }

    findings = {"products_analyzed": {}}

    for product in products[:5]:
        print(f"  💰 Pricing: {product}")

        # If we already have the ASIN, hit product-details directly for price
        asin = asin_map.get(product)
        if asin:
            try:
                headers = {
                    "x-rapidapi-key": os.getenv("RAPIDAPI_KEY"),
                    "x-rapidapi-host": "real-time-amazon-data.p.rapidapi.com",
                }
                resp = requests.get(
                    "https://real-time-amazon-data.p.rapidapi.com/product-details",
                    headers=headers,
                    params={"asin": asin, "country": "IN"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    d = resp.json().get("data", {})
                    amazon_data = {
                        "name":      d.get("product_title", product),
                        "price":     d.get("product_price") or d.get("product_minimum_offer_price", ""),
                        "rating":    d.get("product_star_rating", ""),
                        "reviews":   d.get("product_num_ratings", 0),
                        "url":       d.get("product_url", ""),
                        "available": d.get("product_price") is not None,
                    }
                else:
                    amazon_data = search_amazon_price(product)
            except Exception:
                amazon_data = search_amazon_price(product)
        else:
            amazon_data = search_amazon_price(product)

        if amazon_data:
            price_inr = extract_price_value(amazon_data.get("price", "0"))
            # price_score: scored relative to sibling products — computed after all products collected
            findings["products_analyzed"][product] = {
                "price_inr":           price_inr,
                "price_usd_equivalent": price_inr / 83.5,
                "availability":        amazon_data.get("available", False),
                "rating":              float(amazon_data.get("rating", 0) or 0),
                "reviews_count":       amazon_data.get("reviews", 0),
                "url":                 amazon_data.get("url", ""),
                "price_score":         0,  # filled below after all prices collected
            }
            print(f"     ✅ ₹{price_inr} | Available: {amazon_data.get('available')}")
        else:
            findings["products_analyzed"][product] = {"price_score": 0, "error": "Not found on Amazon.in"}
            print(f"     ❌ Not found on Amazon India")

    # ── Relative price scoring ───────────────────────────────────────────────
    # Score relative to peers: cheapest = 100, most expensive = 0
    # Works correctly regardless of absolute price range (₹50k–₹2L, etc.)
    valid_prices = {
        name: data["price_inr"]
        for name, data in findings["products_analyzed"].items()
        if data.get("price_inr", 0) > 0
    }
    if valid_prices:
        min_price  = min(valid_prices.values())
        max_price  = max(valid_prices.values())
        price_range = max_price - min_price if max_price != min_price else 1
        for name in findings["products_analyzed"]:
            price_inr = findings["products_analyzed"][name].get("price_inr", 0)
            if price_inr > 0:
                score = 100 * (1 - (price_inr - min_price) / price_range)
                findings["products_analyzed"][name]["price_score"] = round(score, 1)

    current_opinions   = state.get("agent_opinions", {})
    current_confidence = state.get("confidence", {})
    priced_count   = sum(1 for v in findings["products_analyzed"].values() if v.get("price_inr", 0) > 0)
    total_count    = max(len(findings["products_analyzed"]), 1)
    avg_confidence = priced_count / total_count

    return {
        "raw_findings":     [{"agent": "price_agent", "data": findings}],
        "agent_opinions":   {**current_opinions,   "price_agent": findings},
        "confidence":       {**current_confidence, "price_agent": avg_confidence},
        "supervisor_notes": [f"[Price Agent] Priced {priced_count}/{total_count} products | confidence={avg_confidence:.2f}"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# RANKER AGENT
# ─────────────────────────────────────────────────────────────────────────────

def ranker_agent_node(state: Blackboard) -> dict:
    opinions     = state.get("agent_opinions", {})
    review_data  = opinions.get("review_agent", {}).get("products_analyzed", {})
    price_data   = opinions.get("price_agent",  {}).get("products_analyzed", {})

    ranked_products = []

    for product_name in set(list(review_data.keys()) + list(price_data.keys())):
        rd = review_data.get(product_name, {})
        pd = price_data.get(product_name, {})

        # quality_score: 0-100 from LLM review analysis
        quality_score      = float(rd.get("rating", 0) or 0)
        # price_score: 0-100 relative among peers (cheapest=100, costliest=0)
        price_score        = float(pd.get("price_score", 0) or 0)
        # availability: binary 0 or 100
        availability_score = 100.0 if pd.get("availability", False) else 0.0

        # Weighted combined: quality 50% + price-value 30% + availability 20%
        combined_score = (quality_score * 0.5) + (price_score * 0.3) + (availability_score * 0.2)

        ranked_products.append({
            "name":               product_name,
            "combined_score":     combined_score,
            "quality_score":      quality_score,
            "price_score":        price_score,
            "availability_score": availability_score,
            "review_data":        rd,
            "price_data":         pd,
        })

    ranked_products.sort(key=lambda x: x["combined_score"], reverse=True)

    winner = ranked_products[0] if ranked_products else None

    result = {
        "ranked": [
            {
                "rank":         i + 1,
                "name":         p["name"],
                "score":        round(p["combined_score"], 1),
                "quality":      round(p["quality_score"], 1),
                "price_score":  round(p["price_score"], 1),
                "price_inr":    p["price_data"].get("price_inr", "N/A"),
                "availability": "✅ In Stock" if p["price_data"].get("availability") else "❌ N/A",
                "amazon_stars": p["price_data"].get("rating", "N/A"),
                "url":          p["price_data"].get("url", "N/A"),
            }
            for i, p in enumerate(ranked_products[:10])
        ],
        "winner": {
            "rank":           1,
            "name":           winner["name"] if winner else "Not found",
            "combined_score": round(winner["combined_score"], 1) if winner else 0,
            "quality_score":  round(winner["quality_score"], 1) if winner else 0,
            "price_score":    round(winner["price_score"], 1) if winner else 0,
            "availability":   "In Stock" if (winner and winner["price_data"].get("availability")) else "Out of Stock",
            "price_inr":      winner["price_data"].get("price_inr", "N/A") if winner else "N/A",
            # amazon star rating comes from price_data; review sentiment from review_data
            "rating":         winner["price_data"].get("rating", "N/A") if winner else "N/A",
            "reviews":        winner["price_data"].get("reviews_count", 0) if winner else 0,
            "url":            winner["price_data"].get("url", "N/A") if winner else "N/A",
            "why":            (
                f"Best overall: quality {winner['quality_score']:.0f}/100 × 50% + "
                f"relative price value {winner['price_score']:.0f}/100 × 30% + "
                f"availability 100/100 × 20% = {winner['combined_score']:.1f}/100"
            ) if winner else "No products found",
            "reasoning":      (
                f"Review quality {winner['quality_score']:.0f}/100 × 0.5 + "
                f"Price-value rank {winner['price_score']:.0f}/100 × 0.3 + "
                f"Availability {winner['availability_score']:.0f}/100 × 0.2 = "
                f"{winner['combined_score']:.1f}/100"
            ) if winner else "N/A",
            "benefits":  winner["review_data"].get("benefits", []) if winner else [],
            "losses":    winner["review_data"].get("losses", [])   if winner else [],
            "confidence": min(0.95, winner["combined_score"] / 100) if winner else 0.1,
        },
        "methodology":     "Combined: Review quality 50% + Relative price-value 30% + Availability 20%",
        "synthesis_notes": f"Evaluated {len(ranked_products)} products | price_score is peer-relative (cheapest=100, costliest=0)",
    }

    current_opinions   = state.get("agent_opinions", {})
    current_confidence = state.get("confidence", {})

    return {
        "agent_opinions":       {**current_opinions,   "ranker": result},
        "confidence":           {**current_confidence, "ranker": result["winner"]["confidence"]},
        "final_recommendation": result,
        "supervisor_notes":     [f"[Ranker] Winner: {result['winner']['name']} "
                                 f"| score: {result['winner']['combined_score']}/100"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# ROUTING
# ─────────────────────────────────────────────────────────────────────────────

def route_from_supervisor(state: Blackboard) -> str:
    next_agent = state.get("next_agent", "DONE")
    iteration  = state.get("iteration", 0)

    if iteration >= 8 or next_agent == "DONE":
        return "ranker_agent"

    search_completed = "search_agent" in state.get("agent_opinions", {})
    review_pending   = "review_agent" not in state.get("agent_opinions", {})
    price_pending    = "price_agent"  not in state.get("agent_opinions", {})

    if search_completed and review_pending and price_pending:
        return "parallel_agents"

    route_map = {
        "search_agent":    "search_agent",
        "review_agent":    "review_agent",
        "price_agent":     "price_agent",
        "parallel_agents": "parallel_agents",
        "ranker_agent":    "ranker_agent",
    }
    return route_map.get(next_agent, "ranker_agent")


# ─────────────────────────────────────────────────────────────────────────────
# PARALLEL AGENTS — runs review + price together after human loop
# ─────────────────────────────────────────────────────────────────────────────

def parallel_agents_node(state: Blackboard) -> dict:
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading

    print(f"\n⚡ Running Review & Price agents in TRUE parallel (threads)…\n")

    results = {}

    def run_review():
        results["review"] = review_agent_node(state)

    def run_price():
        results["price"] = price_agent_node(state)

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = {
            executor.submit(run_review): "review",
            executor.submit(run_price):  "price",
        }
        for future in as_completed(futures):
            agent = futures[future]
            try:
                future.result()  # raises if the thread threw
            except Exception as e:
                print(f"⚠️  [{agent}] thread failed: {e}")
                results.setdefault(agent, {})

    review_result = results.get("review", {})
    price_result  = results.get("price",  {})

    merged_opinions = {
        **state.get("agent_opinions", {}),
        "review_agent": review_result.get("agent_opinions", {}).get("review_agent", {}),
        "price_agent":  price_result.get("agent_opinions",  {}).get("price_agent",  {}),
    }
    merged_confidence = {
        **state.get("confidence", {}),
        **review_result.get("confidence", {}),
        **price_result.get("confidence",  {}),
    }
    merged_findings = (
        state.get("raw_findings", [])
        + review_result.get("raw_findings", [])
        + price_result.get("raw_findings",  [])
    )
    notes = (
        review_result.get("supervisor_notes", [])
        + price_result.get("supervisor_notes",  [])
    )

    return {
        "raw_findings":     merged_findings,
        "agent_opinions":   merged_opinions,
        "confidence":       merged_confidence,
        "supervisor_notes": notes,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GRAPH
# ─────────────────────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    g = StateGraph(Blackboard)

    g.add_node("supervisor",      supervisor_node)
    g.add_node("search_agent",    search_agent_node)
    g.add_node("human_loop",      human_loop_node)
    g.add_node("parallel_agents", parallel_agents_node)
    g.add_node("review_agent",    review_agent_node)
    g.add_node("price_agent",     price_agent_node)
    g.add_node("ranker_agent",    ranker_agent_node)

    g.add_edge(START, "supervisor")

    g.add_conditional_edges(
        "supervisor", route_from_supervisor,
        {
            "search_agent":    "search_agent",
            "review_agent":    "review_agent",
            "price_agent":     "price_agent",
            "parallel_agents": "parallel_agents",
            "ranker_agent":    "ranker_agent",
        },
    )

    g.add_edge("search_agent",    "human_loop")
    g.add_edge("human_loop",      "supervisor")
    g.add_edge("parallel_agents", "supervisor")
    g.add_edge("review_agent",    "supervisor")
    g.add_edge("price_agent",     "supervisor")
    g.add_edge("ranker_agent",    END)

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

    final = None
    for step in app.stream(initial, stream_mode="updates"):
        for node_name, output in step.items():
            for note in output.get("supervisor_notes", []):
                print(f"  {note}")
        final = step

    final  = final or {}
    winner = final.get("ranker_agent", {}).get("final_recommendation", {}).get("winner", {})
    ranked = final.get("ranker_agent", {}).get("final_recommendation", {}).get("ranked", [])

    print(f"\n{'─'*60}")
    print(f"🏆 WINNER: {winner.get('name', 'Not found')}")
    print(f"   Combined Score:  {winner.get('combined_score', 'N/A')}/100")
    print(f"   Quality Score:   {winner.get('quality_score',  'N/A')}/100 (50% weight)")
    print(f"   Price Score:     {winner.get('price_score',    'N/A')}/100 (30% weight)")
    print(f"   Availability:    {winner.get('availability',   'N/A')} (20% weight)")
    print(f"\n   Price (INR):     ₹{winner.get('price_inr', 'N/A')}")
    print(f"   Rating:          {winner.get('rating', 'N/A')} ⭐ ({winner.get('reviews', 0)} reviews)")
    print(f"   Why this one?    {winner.get('why', 'N/A')}")
    print(f"   Reasoning:       {winner.get('reasoning', 'N/A')}")
    print(f"   Benefits:        {', '.join(winner.get('benefits', [])[:3])}")
    print(f"   Caveats:         {', '.join(winner.get('losses',   [])[:2])}")
    print(f"   Buy at:          {winner.get('url', 'N/A')}")
    print(f"   Confidence:      {winner.get('confidence', 'N/A'):.0%}")

    print(f"\n   📊 Top {min(10,len(ranked))} Ranked Products:")
    print(f"   {'#':<3} {'Product':<32} {'Score':>5}  {'Quality':>7}  {'PriceVal':>8}  {'Price(₹)':>9}  {'Avail'}")
    print(f"   {'─'*85}")
    for r in ranked[:10]:
        print(
            f"   #{r.get('rank','?'):<3} {r.get('name','?')[:32]:<32} "
            f"{str(r.get('score','?')):>5}  "
            f"{str(r.get('quality','?')):>7}  "
            f"{str(r.get('price_score','?')):>8}  "
            f"{'₹'+str(int(r.get('price_inr',0))):>9}  "
            f"{r.get('availability','?')}"
        )
    print(f"{'─'*60}\n")

    return winner


if __name__ == "__main__":
    result = find_best_product("best laptop under 100000 lakh")