from tavily import TavilyClient
from backend.utils.request_config import get


def search_reddit(query: str, max_posts: int = 8) -> list:
    """Search Reddit via Tavily (site:reddit.com filter). No Reddit auth needed."""
    api_key = get("TAVILY_API_KEY")
    if not api_key:
        print("  [Reddit] sub-agent: skipped (no Tavily key)")
        return []

    try:
        results = TavilyClient(api_key=api_key).search(
            query=f"site:reddit.com {query}",
            max_results=max_posts,
            include_answer=False,
        )
        posts = []
        for r in results.get("results", []):
            title = r.get("title", "")
            body = (r.get("content") or "").strip()[:600]
            url = r.get("url", "")
            # Extract subreddit from URL if possible
            subreddit = ""
            if "/r/" in url:
                parts = url.split("/r/")
                if len(parts) > 1:
                    subreddit = parts[1].split("/")[0]
            if not title and not body:
                continue
            posts.append({
                "title": title,
                "body": body,
                "score": None,  # Tavily doesn't give upvote counts
                "subreddit": subreddit,
                "url": url,
            })

        print(f"  [Reddit] sub-agent: {len(posts)} posts found (via Tavily)")
        return posts
    except Exception as e:
        print(f"  [Reddit] fetch failed: {e}")
        return []
