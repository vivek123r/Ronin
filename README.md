# RONIN — AI Product Research Platform

> *"Strike with precision. Buy with confidence."*

RONIN is a multi-agent AI system that researches Amazon India products in real time, scores them across quality, price, and availability, and surfaces the single best recommendation — all streamed live through an animated web UI.

---

## How It Works

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Intent Classifier                                          │
│  Detects: discovery vs comparison · budget · keyword        │
└──────────────────┬───────────────────────────┬─────────────┘
                   │ discovery                 │ comparison
                   ▼                           ▼
           Search Agent                Comparison Search
           (Amazon API +               (resolves named
            LLM pick 5)                 products to ASINs)
                   │                           │
                   ▼                           │
            Human Loop                         │
           (skipped in API)                    │
                   │                           │
                   └──────────┬────────────────┘
                              ▼
                    ┌──────────────────┐
                    │  Parallel Agents │
                    │  ┌────────────┐  │
                    │  │Review Agent│  │  YouTube transcripts
                    │  │            │  │  + Amazon reviews
                    │  │ Price Agent│  │  from shared cache
                    │  └────────────┘  │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │  Ranker Agent    │  quality 80%
                    │  (weighted score)│  price   10%
                    └────────┬─────────┘  avail.  10%
                             ▼
                    Final Recommendation
```

The entire pipeline is streamed as **Server-Sent Events** so the animated SpiderHive UI can track every agent in real time.

---

## Project Structure

```
ronin/
├── api.py                        # FastAPI server + SSE streaming
├── a3.py                         # Legacy monolith (kept for reference)
│
├── backend/                      # Modular Python package
│   ├── pipeline.py               # LangGraph graph definition + runner
│   │
│   ├── agents/                   # One file per agent
│   │   ├── state.py              # Blackboard TypedDict (shared state)
│   │   ├── intent.py             # Intent classifier + route logic
│   │   ├── search.py             # Discovery search + human loop + comparison search
│   │   ├── review.py             # YouTube + Amazon review analysis
│   │   ├── price.py              # Price extraction + scoring
│   │   ├── ranker.py             # Final ranking + comparison verdict
│   │   └── parallel.py           # ThreadPoolExecutor wrapper for review + price
│   │
│   ├── integrations/             # External API clients
│   │   ├── amazon.py             # RapidAPI Amazon search + product details
│   │   ├── youtube.py            # YouTube Data API + transcript fetcher
│   │   └── tavily.py             # Tavily web search + LLM extraction
│   │
│   └── utils/
│       ├── llm.py                # Shared ChatOpenAI instance (DeepSeek via OpenRouter)
│       └── json_helpers.py       # extract_json, extract_price_value
│
├── frontend/                     # React + Vite SPA
│   └── src/
│       ├── App.jsx               # State machine: idle → loading → done/error
│       └── components/
│           ├── SpiderHive.jsx    # Canvas animation — 5 spiders, queen bloom
│           ├── LandingPage.jsx   # Search entry
│           ├── ResultsPanel.jsx  # Results layout
│           ├── WinnerCard.jsx    # Winner highlight with score ring
│           ├── RankedTable.jsx   # Full ranked list
│           ├── RadarChart.jsx    # Quality radar
│           ├── AgentReports.jsx  # Per-agent intelligence breakdown
│           ├── ComparisonView.jsx# Side-by-side comparison mode
│           ├── HistorySidebar.jsx# Search history
│           └── SpiderFX.jsx      # Background particle effects
│
├── static/                       # Served by FastAPI at /static
│   └── index.html                # Built frontend (after npm run build)
│
├── .env                          # API keys (never commit)
├── requirements.txt              # Python deps
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | DeepSeek V4 Flash via OpenRouter |
| Orchestration | LangGraph (StateGraph) |
| Product Data | RapidAPI — Real-Time Amazon Data |
| Review Data | YouTube Data API v3 + `youtube-transcript-api` |
| Web Search | Tavily |
| Backend | FastAPI + SSE streaming |
| Frontend | React 18 + Vite + Framer Motion |
| Animation | HTML5 Canvas (rAF loop) |

---

## Setup

### 1. Clone & install Python deps

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

### 2. Configure environment

Create `.env` in the project root:

```env
OPENROUTER_API_KEY=sk-or-v1-...
RAPIDAPI_KEY=...
TAVILY_API_KEY=tvly-...
YOUTUBE_API_KEY=AIza...
```

### 3. Build the frontend

```bash
cd frontend
npm install
npm run build
cp -r dist/* ../static/
```

### 4. Start the server

```bash
# From project root
uvicorn api:app --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000**

---

## Running in Dev Mode (hot reload)

```bash
# Terminal 1 — backend
uvicorn api:app --reload --port 8000

# Terminal 2 — frontend dev server (proxies /search to :8000)
cd frontend
npm run dev
```

---

## Scoring Algorithm

Each product is scored on three axes and combined with **fixed weights**:

| Signal | Source | Weight |
|---|---|---|
| Quality score (0–100) | LLM analysis of Amazon reviews + YouTube transcripts | **80%** |
| Price score (0–100) | `100 × min_price / product_price` (peer-relative) | **10%** |
| Availability score (0 or 100) | In-stock check from Amazon pricing data | **10%** |

If review confidence is below 50%, the quality weight is partially redistributed to price and availability.

**Combined score = quality×0.8 + price×0.1 + availability×0.1**

---

## SpiderHive Animation

The loading screen runs a Canvas animation where five spider agents travel toward the Queen:

| Spider | Agent | Trigger |
|---|---|---|
| 🕷 Hunter | Search Agent | Query submitted |
| 🕷 Reviewer | Review Agent | "Reviewing:" in SSE stream |
| 🕷 Pricer | Price Agent | Same time as Reviewer |
| 🕷 Ranker | Ranker Agent | After Reviewer finishes |
| 👑 Queen | Central node | Always present |

When the Ranker reaches the Queen → **red bloom fills the screen** → results appear.

---

## API Reference

### `POST /search`

Streams Server-Sent Events for a product research query.

**Request body:**
```json
{ "query": "best wireless earbuds under 3000" }
```

**SSE event types:**

| Type | Payload | Description |
|---|---|---|
| `progress` | `{ "message": "..." }` | Pipeline log line |
| `result` | `{ "data": { ... } }` | Final recommendation |
| `error` | `{ "message": "..." }` | Pipeline failure |

### `GET /history`

Returns the last 20 search results (in-memory, resets on server restart).

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | LLM calls (DeepSeek via OpenRouter) |
| `RAPIDAPI_KEY` | Amazon product search + details |
| `TAVILY_API_KEY` | Web search for product hints |
| `YOUTUBE_API_KEY` | YouTube review video search |
