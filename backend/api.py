"""
RONIN FastAPI server -- streams pipeline progress via SSE, serves the React SPA.
"""

import sys
import os
import json
import asyncio
import io
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List
from collections import deque

from dotenv import load_dotenv
load_dotenv()

from backend.agents import search as _search_module
_search_module.API_MODE = True

import backend.pipeline as _pipeline
from backend.utils import request_config as _rc

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from backend.utils.llm import llm as _llm_proxy
from langchain_core.messages import HumanMessage, SystemMessage

history: deque = deque(maxlen=20)

executor = ThreadPoolExecutor(max_workers=4)

_url_requests: Dict[str, Any] = {}
_url_lock = threading.Lock()

app = FastAPI(title="RONIN -- Product Research API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
os.makedirs(static_dir, exist_ok=True)


# Serve static files (CSS, JS, etc.)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
async def root():
    """Serve the React app"""
    return FileResponse(os.path.join(static_dir, "index.html"))


def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


_thread_local = threading.local()


def request_url_from_frontend(product_name: str, reason: str) -> str:
    tid = str(threading.get_ident())
    registered_tid = tid
    entry = _url_requests.get(tid)
    sys.__stdout__.write(f"[DEBUG request_url] called tid={tid} entry={'FOUND' if entry else 'MISSING'} all_keys={list(_url_requests.keys())}\n")
    sys.__stdout__.flush()
    if not entry:
        with _url_lock:
            for k, e in _url_requests.items():
                if e.get("pending") is None:
                    entry = e
                    registered_tid = k
                    break
        sys.__stdout__.write(f"[DEBUG request_url] fallback registered_tid={registered_tid} entry={'FOUND' if entry else 'MISSING'}\n")
        sys.__stdout__.flush()
    if not entry:
        sys.__stdout__.write(f"[DEBUG request_url] NO ENTRY -- returning empty\n")
        sys.__stdout__.flush()
        return ""
    evt = threading.Event()
    with _url_lock:
        entry["pending"] = {"event": evt, "result": None, "product": product_name, "reason": reason}
    sys.__stdout__.write(f"[DEBUG request_url] sending SSE url_request with thread_id={registered_tid}\n")
    sys.__stdout__.flush()
    asyncio.run_coroutine_threadsafe(
        entry["queue"].put({"type": "url_request", "product": product_name, "reason": reason, "thread_id": registered_tid}),
        entry["loop"],
    )
    sys.__stdout__.write(f"[DEBUG request_url] blocking on evt.wait...\n")
    sys.__stdout__.flush()
    evt.wait(timeout=120)
    with _url_lock:
        result = entry.get("pending", {}).get("result") or ""
        entry["pending"] = None
    sys.__stdout__.write(f"[DEBUG request_url] evt fired, result='{result}'\n")
    sys.__stdout__.flush()
    return result


class SSECapture(io.StringIO):
    def __init__(self, queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
        super().__init__()
        self._queue = queue
        self._loop  = loop
        self._buf   = ""

    def write(self, s: str):
        sys.__stdout__.write(s)
        self._buf += s
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            line = line.strip()
            if line:
                asyncio.run_coroutine_threadsafe(
                    self._queue.put({"type": "progress", "message": line}),
                    self._loop,
                )

    def flush(self):
        sys.__stdout__.flush()


@app.post("/search")
async def search(request: Request):
    body   = await request.json()
    query  = body.get("query", "").strip()
    config = body.get("config", {})
    if not query:
        return JSONResponse({"error": "query is required"}, status_code=400)

    async def event_stream():
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()
        capture = SSECapture(queue, loop)

        result_container: Dict[str, Any] = {}
        error_container:  Dict[str, Any] = {}

        def _run():
            tid = str(threading.get_ident())
            with _url_lock:
                _url_requests[tid] = {"queue": queue, "loop": loop, "pending": None}
            _rc.set_config(config)
            old_stdout = sys.stdout
            sys.stdout = capture
            try:
                result = _pipeline.find_best_product(query)
                result_container["result"] = result
            except Exception as exc:
                err = str(exc)
                if err.startswith("WRONG_MODE:"):
                    error_container["wrong_mode"] = err
                else:
                    error_container["error"] = err
            finally:
                sys.stdout = old_stdout
                _rc.clear_config()
                with _url_lock:
                    _url_requests.pop(tid, None)
                asyncio.run_coroutine_threadsafe(queue.put(None), loop)

        executor.submit(_run)

        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=120.0)
            except asyncio.TimeoutError:
                yield sse_event({"type": "error", "message": "Pipeline timed out"})
                break
            if item is None:
                break
            yield sse_event(item)

        if "wrong_mode" in error_container:
            parts = error_container["wrong_mode"].split(":", 2)
            yield sse_event({"type": "wrong_mode", "suggest": parts[1] if len(parts)>1 else "", "message": parts[2] if len(parts)>2 else ""})
        elif error_container:
            yield sse_event({"type": "error", "message": error_container["error"]})
        elif result_container:
            history.append({"query": query, "result": result_container["result"]})
            yield sse_event({"type": "result", "data": result_container["result"]})
        else:
            yield sse_event({"type": "error", "message": "No result returned from pipeline"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":       "keep-alive",
        },
    )


@app.post("/url_response")
async def url_response(request: Request):
    body    = await request.json()
    tid     = body.get("thread_id", "")
    url     = body.get("url", "").strip()
    with _url_lock:
        entry = _url_requests.get(tid)
    if not entry or not entry.get("pending"):
        return JSONResponse({"ok": False, "error": "no pending request"})
    with _url_lock:
        entry["pending"]["result"] = url
        entry["pending"]["event"].set()
    return JSONResponse({"ok": True})


@app.get("/url_pending")
async def url_pending():
    with _url_lock:
        for tid, entry in _url_requests.items():
            pending = entry.get("pending")
            if pending and not pending["event"].is_set():
                return JSONResponse({"pending": True, "thread_id": tid,
                                     "product": pending["product"], "reason": pending["reason"]})
    return JSONResponse({"pending": False})


@app.get("/providers")
async def get_providers():
    return JSONResponse([
        { "id": "openrouter", "label": "OpenRouter",   "url": "https://openrouter.ai/keys",           "keyLabel": "API Key",        "defaultModel": "deepseek/deepseek-v4-flash",          "modelPlaceholder": "e.g. deepseek/deepseek-v4-flash" },
        { "id": "openai",     "label": "OpenAI",       "url": "https://platform.openai.com/api-keys",  "keyLabel": "API Key",        "defaultModel": "gpt-4o-mini",                        "modelPlaceholder": "e.g. gpt-4o-mini" },
        { "id": "anthropic",  "label": "Anthropic",    "url": "https://console.anthropic.com/keys",    "keyLabel": "API Key",        "defaultModel": "claude-haiku-4-5-20251001",          "modelPlaceholder": "e.g. claude-haiku-4-5-20251001" },
        { "id": "groq",       "label": "Groq",         "url": "https://console.groq.com/keys",         "keyLabel": "API Key",        "defaultModel": "llama-3.3-70b-versatile",            "modelPlaceholder": "e.g. llama-3.3-70b-versatile" },
        { "id": "together",   "label": "Together AI",  "url": "https://api.together.xyz/settings/api-keys", "keyLabel": "API Key", "defaultModel": "meta-llama/Llama-3.3-70B-Instruct-Turbo", "modelPlaceholder": "e.g. meta-llama/Llama-3.3-70B-Instruct-Turbo" },
        { "id": "mistral",    "label": "Mistral",      "url": "https://console.mistral.ai/api-keys",   "keyLabel": "API Key",        "defaultModel": "mistral-small-latest",               "modelPlaceholder": "e.g. mistral-small-latest" },
        { "id": "ollama",     "label": "Ollama (local)","url": "https://ollama.com",                   "keyLabel": "Model name",     "defaultModel": "llama3.2",                           "modelPlaceholder": "e.g. llama3.2" },
    ])


@app.get("/config-status")
async def config_status():
    """Tell the frontend whether the server has default API keys configured."""
    return JSONResponse({
        "has_defaults": bool(os.getenv("RAPIDAPI_KEY") and os.getenv("LLM_API_KEY") or os.getenv("OPENROUTER_API_KEY"))
    })


@app.get("/history")
async def get_history():
    return JSONResponse(list(history))


# -- /chat endpoint -- conversational follow-up about research results ---------
_CHAT_SYSTEM = """You are an AI product intelligence analyst for RONIN (Rise of Neural Intelligence Networks).
You have researched products and gathered review data, pricing, specs, and category scores.

Your task: answer follow-up questions about the products. Be specific, reference actual data, and give recommendations.

CRITICAL RULES:
- Keep every reply to 1-3 SHORT sentences. Be direct and punchy, like a military intelligence briefing.
- Use bullet points (2-4 max) when listing facts or comparisons.
- Reference specific scores, prices, and data points from the context.
- If asked about something not in the data, say so honestly in one sentence.
- Never make up product specifications not present in the provided context.
- No greetings, no "hope this helps", no pleasantries. Just the answer."""


@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    context = body.get("context", {})          # the full result object
    messages = body.get("messages", [])         # conversation history [{role, content}]
    config = body.get("config", {})             # API keys

    if not messages:
        return JSONResponse({"error": "messages required"}, status_code=400)

    # Set per-request config for the LLM
    _rc.set_config(config)

    try:
        # Build system message with full product context
        context_str = json.dumps(context, indent=2, ensure_ascii=False)
        system_content = f"{_CHAT_SYSTEM}\n\nCurrent research data:\n{context_str}"

        # Build langchain messages
        lc_messages = [SystemMessage(content=system_content)]
        for msg in messages:
            if msg.get("role") == "user":
                lc_messages.append(HumanMessage(content=msg.get("content", "")))

        response = _llm_proxy.invoke(lc_messages)
        return JSONResponse({"reply": response.content})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        _rc.clear_config()


@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    """Serve index.html for any unmatched routes (for React Router compatibility)"""
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"error": "Not found"}, status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
