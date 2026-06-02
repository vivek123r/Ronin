"""
RONIN FastAPI server — streams pipeline progress via SSE, serves the React SPA.
"""

import sys
import os
import json
import asyncio
import io
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any
from collections import deque

from dotenv import load_dotenv
load_dotenv()

# Enable API mode so the pipeline skips the interactive human_loop
from backend.agents import search as _search_module
_search_module.API_MODE = True

import backend.pipeline as _pipeline
from backend.utils import request_config as _rc

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# ── In-memory history (last 20 searches) ─────────────────────────────────────
history: deque = deque(maxlen=20)

# ── Thread pool for the blocking pipeline ────────────────────────────────────
executor = ThreadPoolExecutor(max_workers=4)

# ── Per-request URL prompt store (thread_id → {event, result, queue, loop}) ──
_url_requests: Dict[str, Any] = {}
_url_lock = threading.Lock()

app = FastAPI(title="RONIN — Product Research API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ──────────────────────────────────────────────────────────────
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
os.makedirs(static_dir, exist_ok=True)

wallpaper_src = r"C:\Users\vivek\Downloads\samurai-warrior-night-by-lake.jpg"
wallpaper_dst = os.path.join(static_dir, "samurai.jpg")
if os.path.exists(wallpaper_src) and not os.path.exists(wallpaper_dst):
    import shutil
    shutil.copy2(wallpaper_src, wallpaper_dst)

app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
async def index():
    return FileResponse(os.path.join(static_dir, "index.html"))


# ── SSE helper ────────────────────────────────────────────────────────────────
def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


# ── Per-request stdout capture → SSE queue ───────────────────────────────────
_thread_local = threading.local()


def request_url_from_frontend(product_name: str, reason: str) -> str:
    """Called from pipeline thread. Sends url_request SSE event, blocks until frontend responds."""
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
        sys.__stdout__.write(f"[DEBUG request_url] NO ENTRY — returning empty\n")
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


# ── /search SSE endpoint ──────────────────────────────────────────────────────
@app.post("/search")
async def search(request: Request):
    body   = await request.json()
    query  = body.get("query", "").strip()
    config = body.get("config", {})   # user-supplied API keys / LLM config
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
                error_container["error"] = str(exc)
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

        if error_container:
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


# ── /url_response endpoint — frontend submits URL back to waiting pipeline ───
@app.post("/url_response")
async def url_response(request: Request):
    body    = await request.json()
    tid     = body.get("thread_id", "")
    url     = body.get("url", "").strip()
    sys.__stdout__.write(f"[DEBUG url_response] tid={tid} url={url[:80]} all_keys={list(_url_requests.keys())}\n")
    sys.__stdout__.flush()
    with _url_lock:
        entry = _url_requests.get(tid)
    if not entry or not entry.get("pending"):
        sys.__stdout__.write(f"[DEBUG url_response] FAILED — entry={entry} pending={entry.get('pending') if entry else None}\n")
        sys.__stdout__.flush()
        return JSONResponse({"ok": False, "error": "no pending request"})
    with _url_lock:
        entry["pending"]["result"] = url
        entry["pending"]["event"].set()
    sys.__stdout__.write(f"[DEBUG url_response] SUCCESS — event fired\n")
    sys.__stdout__.flush()
    return JSONResponse({"ok": True})


# ── /url_pending — frontend polls to get the thread_id for a live search ─────
@app.get("/url_pending")
async def url_pending():
    """Returns any pending URL request (product + thread_id) so frontend can display the modal."""
    with _url_lock:
        for tid, entry in _url_requests.items():
            pending = entry.get("pending")
            if pending and not pending["event"].is_set():
                return JSONResponse({"pending": True, "thread_id": tid,
                                     "product": pending["product"], "reason": pending["reason"]})
    return JSONResponse({"pending": False})


# ── /providers endpoint ───────────────────────────────────────────────────────
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


# ── /history endpoint ─────────────────────────────────────────────────────────
@app.get("/history")
async def get_history():
    return JSONResponse(list(history))


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api:app", host="0.0.0.0", port=8000, reload=False)
