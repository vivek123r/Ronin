import os
from tavily import TavilyClient
from backend.utils.llm import llm
from backend.utils.json_helpers import extract_json
from langchain_core.messages import HumanMessage, SystemMessage
from dotenv import load_dotenv

load_dotenv()

_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))


def search_tavily(query: str, max_results: int = 15) -> list:
    """Search the web via Tavily and extract product name candidates using LLM."""
    try:
        results = _client.search(
            query=f"{query} best India",
            max_results=max_results,
            include_answer=True,
        )
        snippets = [
            f"- {r.get('title', '')}: {r.get('content', '')[:300]}"
            for r in results.get("results", [])
        ]
        if not snippets:
            return []

        response = llm.invoke([
            SystemMessage(content=(
                "You are a product extraction assistant. "
                "Given web search results about products, extract a list of specific product model names. "
                "Return ONLY raw JSON — no markdown, no backticks:\n"
                '{"products": ["Product Model Name 1", "Product Model Name 2", ...]}'
            )),
            HumanMessage(content=(
                f"Query: {query}\n\nWeb search results:\n"
                + "\n".join(snippets)
                + "\n\nExtract up to 15 specific product names mentioned. "
                  "Include brand and model number where available."
            )),
        ])
        return extract_json(response.content).get("products", [])
    except Exception as e:
        print(f"⚠️  Tavily search failed: {e}")
        return []
