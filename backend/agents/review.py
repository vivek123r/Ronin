from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.agents.state import Blackboard
from backend.utils.llm import llm
from backend.utils.json_helpers import extract_json
from backend.utils.request_config import get
from backend.integrations.reddit import search_reddit
from langchain_core.messages import HumanMessage, SystemMessage

_SYSTEM = """You are a review and sentiment analyst.
- Analyse data from Amazon verified reviews, YouTube expert transcripts, and Reddit community discussions
- Score each product 0-100 based on what real users and reviewers actually said
- Weight verified Amazon purchases heavily; treat YouTube transcripts as expert opinion; treat Reddit upvoted posts as community consensus
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


def _fetch_amazon_reviews(product: str, product_cache: dict) -> dict:
    return product_cache.get(product, {})


def _fetch_youtube_reviews(product: str) -> list:
    yt_key = get("YOUTUBE_API_KEY")
    if not yt_key:
        print(f"  [YouTube sub-agent]: skipped (no API key)")
        return []
    from backend.integrations.youtube import search_youtube
    for attempt in range(2):
        try:
            results = search_youtube(product, max_results=2)
            print(f"  [YouTube sub-agent]: {len(results)} videos for {product[:40]}")
            return results
        except Exception as e:
            if attempt == 0:
                print(f"  [YouTube sub-agent]: retry after error: {e}")
            else:
                print(f"  [YouTube sub-agent]: skipped after 2 failures")
    return []


def _fetch_reddit_reviews(product: str) -> list:
    for attempt in range(2):
        try:
            return search_reddit(f"{product} review")
        except Exception as e:
            if attempt == 0:
                print(f"  [Reddit sub-agent]: retry after error: {e}")
            else:
                print(f"  [Reddit sub-agent]: skipped after 2 failures")
    return []


def _review_product(product: str, product_cache: dict) -> tuple:
    print(f"  📺 Reviewing: {product[:70]}")

    # Run all 3 sub-agents in parallel; individual failures return empty data
    amazon_data, youtube_data, reddit_data = {}, [], []
    try:
        with ThreadPoolExecutor(max_workers=3) as ex:
            f_amazon  = ex.submit(_fetch_amazon_reviews, product, product_cache)
            f_youtube = ex.submit(_fetch_youtube_reviews, product)
            f_reddit  = ex.submit(_fetch_reddit_reviews, product)
            try: amazon_data  = f_amazon.result(timeout=30)
            except Exception as e: print(f"  [Amazon sub-agent]: failed: {e}")
            try: youtube_data = f_youtube.result(timeout=30)
            except Exception as e: print(f"  [YouTube sub-agent]: failed: {e}")
            try: reddit_data  = f_reddit.result(timeout=30)
            except Exception as e: print(f"  [Reddit sub-agent]: failed: {e}")
    except Exception as e:
        print(f"  [Review] sub-agent pool error: {e}")

    # Format Amazon section
    amz_section = ""
    if amazon_data:
        amz_section = (
            f"\n### Amazon ({amazon_data.get('avg_rating','?')}⭐, "
            f"{amazon_data.get('num_ratings','?')} ratings)\n"
            f"Rating distribution: {amazon_data.get('rating_distribution', {})}\n"
        )
        for r in amazon_data.get("reviews", []):
            tag = "✅ Verified" if r.get("verified") else "Unverified"
            amz_section += f"- [{r.get('stars','?')}★ {tag}] {r.get('title','')}: {r.get('body','')[:300]}\n"

    # Format YouTube section
    yt_section = ""
    for v in youtube_data:
        snippet = v["transcript"][:1500] if v.get("transcript") else "[none]"
        yt_section += f"\n### YouTube: {v['title']} ({v['channel']})\n{snippet}\n"

    # Format Reddit section
    reddit_section = ""
    for p in reddit_data:
        sub = p.get('subreddit') or 'reddit'
        reddit_section += (
            f"\n### Reddit r/{sub}\n"
            f"**{p['title']}**\n{p['body']}\n"
        )

    sources_used = sum([bool(amz_section), bool(yt_section), bool(reddit_section)])
    print(f"     {sources_used}/3 sources available — invoking LLM scorer")

    response = llm.invoke([
        SystemMessage(content=_SYSTEM),
        HumanMessage(content=(
            f"Product: {product}\n\n"
            f"{amz_section or 'No Amazon reviews found.'}\n\n"
            f"{yt_section or 'No YouTube transcripts found.'}\n\n"
            f"{reddit_section or 'No Reddit discussions found.'}\n\n"
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

    print(f"     ✅ Rating: {result.get('rating','?')}/100 | AMZ:{len(amazon_data.get('reviews',[]))} YT:{len(youtube_data)} RDT:{len(reddit_data)}")
    return product, result


def review_agent_node(state: Blackboard) -> dict:
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

    # Signal sub-agents starting (fires waves in SpiderHive)
    print(f"  [Amazon sub-agent]: {sum(len(product_cache.get(p,{}).get('reviews',[])) for p in products[:5])} reviews cached")
    print(f"  [Reddit sub-agent]: scanning community posts")

    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(_review_product, p, product_cache): p for p in products[:2]}
        for future in as_completed(futures):
            p = futures[future]
            try:
                product, result = future.result(timeout=60)
                findings["products_analyzed"][product] = result
            except Exception as e:
                print(f"  [Review] skipped {p[:40]}: {e}")
                findings["products_analyzed"][p] = {
                    "rating": 50, "benefits": [], "losses": ["Review fetch failed"],
                    "sentiment": "neutral", "confidence": 0.2, "review_highlights": [],
                }

    avg_confidence = (
        sum(v.get("confidence", 0) for v in findings["products_analyzed"].values())
        / max(len(findings["products_analyzed"]), 1)
    )
    count = len(findings["products_analyzed"])
    print(f"  [Review] sending intelligence to master — {count} products analyzed")
    print(f"  ✅ [Review] {count} products analyzed")

    return {
        "raw_findings":   [{"agent": "review_agent", "data": findings}],
        "agent_opinions": {**state.get("agent_opinions", {}), "review_agent": findings},
        "confidence":     {**state.get("confidence", {}), "review_agent": avg_confidence},
        "notes":          [f"[Review] {count} products | confidence={avg_confidence:.2f}"],
    }
