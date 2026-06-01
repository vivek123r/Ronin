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

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# ── In-memory history (last 20 searches) ─────────────────────────────────────
history: deque = deque(maxlen=20)

# ── Thread pool for the blocking pipeline ────────────────────────────────────
executor = ThreadPoolExecutor(max_workers=4)

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
    body  = await request.json()
    query = body.get("query", "").strip()
    if not query:
        return JSONResponse({"error": "query is required"}, status_code=400)

    async def event_stream():
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()
        capture = SSECapture(queue, loop)

        result_container: Dict[str, Any] = {}
        error_container:  Dict[str, Any] = {}

        def _run():
            old_stdout = sys.stdout
            sys.stdout = capture
            try:
                result = _pipeline.find_best_product(query)
                result_container["result"] = result
            except Exception as exc:
                error_container["error"] = str(exc)
            finally:
                sys.stdout = old_stdout
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


# ── /history endpoint ─────────────────────────────────────────────────────────
@app.get("/history")
async def get_history():
    return JSONResponse(list(history))


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api:app", host="0.0.0.0", port=8000, reload=False)
