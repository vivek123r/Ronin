from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.agents.state import Blackboard
from backend.utils.llm import llm
from backend.utils.json_helpers import extract_json
from backend.integrations.youtube import search_youtube
from langchain_core.messages import HumanMessage, SystemMessage

_SYSTEM = """You are a review and sentiment analyst.
- Analyse real Amazon customer reviews and YouTube video transcripts
- Score each product 0-100 based on what real users and reviewers actually said
- Weight verified Amazon purchases heavily; treat YouTube transcripts as expert opinion
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


def _review_product(product: str, product_cache: dict) -> tuple:
    print(f"  📺 Reviewing: {product[:70]}")
    yt_results     = search_youtube(product, max_results=4)
    amazon_reviews = product_cache.get(product, {})

    yt_section = ""
    for v in yt_results:
        snippet = v["transcript"][:1500] if v["transcript"] else "[none]"
        yt_section += f"\n### YouTube: {v['title']} ({v['channel']})\n{snippet}\n"

    amz_section = ""
    if amazon_reviews:
        amz_section = (
            f"\n### Amazon ({amazon_reviews.get('avg_rating','?')}⭐, "
            f"{amazon_reviews.get('num_ratings','?')} ratings)\n"
            f"Rating distribution: {amazon_reviews.get('rating_distribution', {})}\n"
        )
        for r in amazon_reviews.get("reviews", []):
            tag = "✅ Verified" if r.get("verified") else "Unverified"
            amz_section += f"- [{r.get('stars','?')}★ {tag}] {r.get('title','')}: {r.get('body','')[:300]}\n"

    response = llm.invoke([
        SystemMessage(content=_SYSTEM),
        HumanMessage(content=(
            f"Product: {product}\n\n"
            f"{yt_section or 'No YouTube transcripts found.'}\n\n"
            f"{amz_section or 'No Amazon reviews found.'}\n\n"
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

    print(f"     ✅ Rating: {result.get('rating','?')}/100 | YT: {len(yt_results)} | Reviews: {len(amazon_reviews.get('reviews', []))}")
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

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_review_product, p, product_cache): p for p in products[:5]}
        for future in as_completed(futures):
            product, result = future.result()
            findings["products_analyzed"][product] = result

    avg_confidence = (
        sum(v.get("confidence", 0) for v in findings["products_analyzed"].values())
        / max(len(findings["products_analyzed"]), 1)
    )
    count = len(findings["products_analyzed"])
    print(f"  ✅ [Review] {count} products analyzed")

    return {
        "raw_findings":   [{"agent": "review_agent", "data": findings}],
        "agent_opinions": {**state.get("agent_opinions", {}), "review_agent": findings},
        "confidence":     {**state.get("confidence", {}), "review_agent": avg_confidence},
        "notes":          [f"[Review] {count} products | confidence={avg_confidence:.2f}"],
    }
