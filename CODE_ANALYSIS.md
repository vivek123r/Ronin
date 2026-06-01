# RONIN — Complete Codebase Analysis

## 🎯 Project Overview

**RONIN** is a **Multi-Agent AI Product Intelligence System** that analyzes and ranks products using LangGraph, DeepSeek LLM, and real-time data from Amazon & YouTube. It operates in two modes:

1. **Discovery Mode**: Finds the best product for a given criteria
2. **Comparison Mode**: Side-by-side analysis of specific products

---

## 📊 Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI (Python), LangGraph |
| **Frontend** | React 19, Vite, Tailwind CSS 4, Framer Motion |
| **LLM** | DeepSeek v4-Flash via OpenRouter API |
| **Data Sources** | Amazon RapidAPI, YouTube API, Tavily Search |
| **Streaming** | Server-Sent Events (SSE) for real-time progress |

### Core Dependencies

**Python** (`requirements.txt`):
```
langchain-openai
langchain-core
langchain-community
langgraph>=0.2.0
tavily-python
python-dotenv
```

**Frontend** (`package.json`):
```json
{
  "react": "^19.2.6",
  "framer-motion": "^12.40.0",
  "tailwindcss": "^4.3.0",
  "lucide-react": "^1.17.0"
}
```

---

## 🏗️ Backend Architecture

### 1. **api.py** — FastAPI Server

**Purpose**: Wraps LangGraph pipeline, serves SSE streams, manages history

**Key Components**:

```python
# FastAPI app with CORS enabled
app = FastAPI(title="Product Research API")

# SSE streaming endpoint
@app.post("/search")
async def search(request: Request):
    # Streams progress + final result
    # Captures stdout from worker thread
    # Returns Server-Sent Events
```

**Flow**:
1. Client sends JSON query → `/search` endpoint
2. Pipeline runs in ThreadPoolExecutor (non-blocking)
3. `SSECapture` intercepts stdout → asyncio queue
4. FastAPI yields SSE events to client in real-time
5. Final result sent when pipeline completes

**History Management**:
- In-memory deque (max 20 searches)
- Accessible via `/history` endpoint
- Client also caches in localStorage

---

### 2. **a3.py** — Multi-Agent Pipeline (LangGraph)

**Core Concept**: Sequential agents + parallel execution, shared state via "Blackboard"

#### **State Definition** (Blackboard TypedDict)

```python
class Blackboard(TypedDict):
    query: str
    search_keyword: str          # cleaned for Amazon search
    mode: str                    # "discovery" | "comparison"
    comparison_products: List[str]  # for comparison mode
    budget_type: str            # "under", "around", "range", "none"
    budget_min/max: int         # INR bounds
    raw_findings: List[dict]    # all agent outputs
    agent_opinions: Dict[str, Any]  # each agent's structured result
    confidence: Dict[str, float]    # confidence per agent
    notes: List[str]            # progress messages
    final_recommendation: Dict[str, Any]  # winner or comparison
```

---

### **Agent Nodes & Flow**

#### **1. Intent Classifier** ➜ Routes to Discovery or Comparison

**Input**: Raw query
**LLM Task**: 
- Classify: discovery vs comparison
- Extract: budget (type, min, max)
- Generate: clean search keyword for Amazon

**Output**:
```python
{
  "mode": "discovery" | "comparison",
  "products": [],  # only populated for comparison
  "budget_type": "none" | "under" | "around" | "range",
  "budget_min": 0,
  "budget_max": 0,
  "search_keyword": "clean product keyword"
}
```

**Example Parsing**:
- Query: `"best TWS earbuds under 3000"`
  - Mode: discovery
  - Budget: under, max=3000
  - Keyword: "TWS earbuds"

---

#### **2. Search Agent** (Discovery Path)

**Workflow**:
1. **Amazon Broad Search** (1 RapidAPI call)
   - Uses intent-aware price filtering
   - Fallback: retry without price if < 5 results
   - Fallback 2: retry with full query if keyword returns 0

2. **Candidate Scoring** 
   - Score = Web recommendation bonus + Amazon rating
   - LLM picks top 5 distinct products from Amazon results

3. **Parallel Product Detail Fetching** (5 ThreadPoolExecutor workers)
   - Fetches reviews, pricing, availability per ASIN
   - Caches in state for review_agent & price_agent

**Output**:
```python
{
  "products": ["Sony XB40", "JBL Flip7", ...],
  "asin_map": {"Sony XB40": "B0XXXX", ...},
  "product_cache": {
    "Sony XB40": {
      "product_title": "...",
      "avg_rating": 4.5,
      "num_ratings": 12000,
      "reviews": [...],
      "product_price": "₹3,999",
      "product_url": "https://..."
    }
  },
  "confidence": 0.9
}
```

---

#### **3. Comparison Search Agent** (Comparison Path)

**Triggered when**: Query explicitly names 2+ products (e.g., "iPhone 15 vs Samsung S24")

**Workflow**:
1. **Resolve product names to ASINs** (parallel)
   - LLM validation: does resolved product match user intent?
   - Fallback: prompt user for Amazon URL if validation fails
   - Duplicate detection: prevents comparing same product twice

2. **Fetch product details** (same as discovery)

---

#### **4. Human Loop Node** (Discovery Only, Skipped in API Mode)

**CLI-based user confirmation** (skipped when `API_MODE=True`):
- Show discovered products
- Allow removal of products
- Allow addition of manual products (Amazon-resolved)
- Require confirmation before proceeding

---

#### **5. Review Agent** (Parallel with Price Agent)

**Runs in parallel** using ThreadPoolExecutor(max_workers=5)

**Per-product workflow**:
1. Fetch YouTube reviews (up to 4 videos)
   - Extract transcripts via YouTube Transcript API
   - Take first 120 segments (~1500 chars)

2. Fetch Amazon reviews from cache
   - Rating distribution
   - Top reviews with verified purchase tags

3. **LLM Sentiment Analysis**:
   - Input: YouTube transcripts + Amazon reviews
   - Output: quality_score (0-100), benefits, losses, sentiment, confidence

**Output**:
```python
{
  "products_analyzed": {
    "Sony XB40": {
      "rating": 82,
      "benefits": ["Great bass", "Long battery"],
      "losses": ["Lack of noise cancellation"],
      "sentiment": "positive",
      "confidence": 0.85,
      "review_highlights": ["Quoted from real reviews"]
    }
  }
}
```

---

#### **6. Price Agent** (Parallel with Review Agent)

**Per-product workflow**:
1. Extract price from cached product data
2. Fallback search if price missing
3. **Relative price scoring**: `score = 10 × min_price / product_price`
   - Cheapest = 10.0, 10% more expensive ≈ 9.1

**Output**:
```python
{
  "products_analyzed": {
    "Sony XB40": {
      "price_inr": 3999,
      "price_score": 9.8,
      "availability": true,
      "url": "https://amazon.in/dp/B0XXXX"
    }
  }
}
```

---

#### **7. Ranker Agent** (Discovery Path)

**Adaptive Weight Derivation** (1 LLM call):
- Analyzes query intent
- Returns weights: quality + price + availability = 1.0

**Examples**:
- "best gaming laptop" → quality: 60%, price: 20%, availability: 20%
- "best under 50k" → quality: 30%, price: 50%, availability: 20%

**Per-product Scoring**:
```python
combined_score = (
  quality_score × quality_weight +
  price_score × price_weight +
  availability_score × availability_weight
)
```

**Data Quality Adjustment**:
- If review confidence < 50%, redistribute quality weight toward price/availability
- Prevents low-confidence reviews from dominating score

**Output** (Top 10 + Winner):
```python
{
  "ranked": [
    {"rank": 1, "name": "Sony XB40", "score": 87.5, "price_inr": 3999},
    ...
  ],
  "winner": {
    "name": "Sony XB40",
    "combined_score": 87.5,
    "quality_score": 82,
    "price_score": 9.8,
    "benefits": [...],
    "losses": [...],
    "why": "Explanation of scoring"
  }
}
```

---

#### **8. Comparison Ranker** (Comparison Path)

**Workflow**:
1. Build side-by-side comparison table
2. LLM generates verdict: who should buy which product
3. Identifies best_value & best_performance

**Output**:
```python
{
  "mode": "comparison",
  "comparison_table": [
    {
      "name": "iPhone 15",
      "quality": 85,
      "price_inr": 79990,
      "price_score": 8.5,
      "benefits": [...],
      "losses": [...]
    }
  ],
  "verdict": "iPhone 15 for performance, Samsung S24 for value",
  "best_value": "Samsung S24",
  "best_performance": "iPhone 15"
}
```

---

### **LangGraph Flow**

```
START
  ↓
intent_classifier
  ↓
  ├─→ "discovery" ────→ search_agent
  │                         ↓
  │                    human_loop
  │                         ↓
  └─→ "comparison" ───→ comparison_search_agent
                              ↓
                    parallel_agents (review + price)
                              ↓
                    ╔═════════════════╗
                    ║ route_decision  ║
                    ╠═════════════════╣
                    ║ discovery       ║ → ranker_agent ──→ output
                    ║ comparison      ║ → comparison_ranker ──→ output
                    ╚═════════════════╝
```

---

## 🎨 Frontend Architecture

### Project Structure

```
frontend/
├── src/
│   ├── App.jsx              # Main React component
│   ├── App.css              # App styles
│   ├── main.jsx             # Entry point
│   ├── components/
│   │   ├── LandingPage.jsx      # Hero section
│   │   ├── Hero.jsx             # Hero with search
│   │   ├── SpiderHive.jsx       # Live research progress
│   │   ├── ProgressFeed.jsx     # Log display
│   │   ├── ResultsPanel.jsx     # Results container
│   │   ├── RankedTable.jsx      # Ranked products table
│   │   ├── WinnerCard.jsx       # Winner showcase
│   │   ├── ComparisonView.jsx   # Side-by-side comparison
│   │   ├── HistorySidebar.jsx   # Search history
│   │   ├── SpiderFX.jsx         # Background animations
│   │   └── SwarmFX.jsx          # Particle effects
│   └── assets/
└── static/
    └── index.html           # Standalone static HTML (no React)
```

### Dual Frontend Approach

**Two separate frontends are provided**:

#### **1. React SPA** (`frontend/`)
- Modern component-based architecture
- Vite build system
- Framer Motion animations
- Real-time SSE streaming

**Key Components**:
- `App.jsx`: Main state management (query, progress, results, history)
- `SpiderHive.jsx`: Displays live agent progress
- `RankedTable.jsx`: Interactive ranked products table with expand rows
- `ComparisonView.jsx`: Side-by-side comparison cards
- `HistorySidebar.jsx`: Previous searches

#### **2. Vanilla HTML/CSS/JS** (`static/index.html`)
- Single-file standalone app
- No build dependencies
- Works without npm/Node.js
- Glass morphism UI with TailwindCSS CDN

Both serve the same backend API but offer different UX patterns.

---

## 🔄 Data Flow

### Complete Request Journey

```
User Query
    ↓
[Client] POST /search with query
    ↓
[Server] api.py event_stream()
    ├→ ThreadPoolExecutor runs a3.find_best_product()
    ├→ SSECapture intercepts stdout
    └→ Streams progress events in real-time
    ↓
[Backend] LangGraph Pipeline
    ├→ Intent Classifier (LLM call #1)
    ├→ Search/Comparison Agent (RapidAPI calls)
    ├→ Review Agent (YouTube + Amazon, LLM call #2)
    ├→ Price Agent (Pricing logic)
    ├→ Ranker Agent (LLM call #3)
    └→ Returns structured result
    ↓
[Server] Yields final result as SSE event
    ↓
[Client] Renders winner/comparison
    ↓
[Client] Stores in localStorage history
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Serve index.html (SPA) |
| `/search` | POST | Stream research (SSE) |
| `/history` | GET | List past searches |
| `/static/*` | GET | Static files (samurai.jpg) |

---

## 🔐 Environment Variables

**Required in `.env`**:

```bash
OPENROUTER_API_KEY=sk_...              # DeepSeek via OpenRouter
RAPIDAPI_KEY=...                       # Amazon data via RapidAPI
YOUTUBE_API_KEY=...                    # YouTube search
TAVILY_API_KEY=...                     # Web search (optional)
```

---

## 🎯 Key Design Patterns

### 1. **Shared Blackboard State**
All agents read/write to a TypedDict, enabling:
- Product cache sharing (search → review + price agents)
- Confidence tracking per agent
- Audit trail of all agent outputs

### 2. **Parallel Execution**
Review & Price agents run simultaneously in thread pool:
```python
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = {...}
    for future in as_completed(futures):
        # process result
```

### 3. **Robust JSON Extraction**
Handles LLM markdown, extra text, malformed JSON:
```python
def extract_json(text: str) -> dict:
    # Try direct parse
    # Strip markdown, try again
    # Find {} bounds, parse substring
    # Fallback: return {}
```

### 4. **SSE Streaming**
Real-time progress without WebSockets:
```python
# Backend: yield sse_event({"type": "progress", "message": "..."})
# Frontend: SSE parser extracts JSON
```

### 5. **Adaptive Scoring**
Adjusts weights based on:
- Query intent (LLM-derived)
- Data quality per product (confidence scores)
- Relative pricing (not absolute)

---

## 🛠️ Utility Functions

### Text Processing
- `extract_json()`: Robust JSON parsing from LLM output
- `extract_price_value()`: "₹45,000" → 45000.0
- `escHtml()`: XSS prevention

### API Integrations
- `search_youtube()`: Query + transcript extraction
- `get_amazon_reviews_by_asin()`: RapidAPI call with retry
- `_resolve_product_name()`: Search Amazon, LLM validation
- `search_tavily()`: Web search + product extraction

### Parallel Operations
- ThreadPoolExecutor for product detail fetching
- as_completed() for async result processing

---

## 📈 Response Examples

### Discovery Mode Success

```json
{
  "final_recommendation": {
    "mode": "discovery",
    "winner": {
      "name": "Sony WH-1000XM5",
      "combined_score": 88.5,
      "quality_score": 85.0,
      "price_score": 9.2,
      "price_inr": 24990,
      "availability": "In Stock",
      "confidence": 0.87,
      "benefits": ["Best ANC", "40-hour battery"],
      "losses": ["Expensive"],
      "why": "Quality: 0.60 × 85 + Price: 0.25 × 9.2 + Availability: 0.15 × 100 = 88.5"
    },
    "ranked": [
      {"rank": 1, "name": "Sony XB40", "score": 88.5, ...},
      {"rank": 2, "name": "JBL Flip7", "score": 82.1, ...}
    ]
  }
}
```

### Comparison Mode Success

```json
{
  "final_recommendation": {
    "mode": "comparison",
    "comparison_table": [
      {
        "name": "iPhone 15",
        "quality": 89,
        "price_inr": 79990,
        "benefits": ["Best camera", "Ecosystem"],
        "losses": ["No charger in box"]
      },
      {
        "name": "Samsung S24",
        "quality": 87,
        "price_inr": 69990,
        "benefits": ["Good value", "Bright display"],
        "losses": ["Bloatware"]
      }
    ],
    "verdict": "iPhone for photography, Samsung for value",
    "best_value": "Samsung S24",
    "best_performance": "iPhone 15"
  }
}
```

---

## ⚡ Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Intent classification | ~1-2s | 1 LLM call |
| Amazon search | ~2-3s | 1 RapidAPI call |
| Product detail fetch | ~3-5s | 5 parallel RapidAPI calls |
| YouTube search + transcripts | ~3-5s | Per product |
| Review analysis | ~2-4s | LLM sentiment analysis |
| Price calculation | ~0.5s | Relative scoring |
| Ranking | ~1-2s | 1 LLM call + sorting |
| **Total (discovery)** | **~15-20s** | Parallel agents overlap |
| **Total (comparison)** | **~12-18s** | Skips Tavily, faster search |

---

## 🔍 Error Handling

**Graceful Degradation**:
1. API fails → Skip step, continue
2. Missing data → Use defaults, note confidence impact
3. LLM parse fails → Fallback JSON structure
4. Duplicate products → Prompt user URL
5. Product not found → Return to human_loop

**Error Messages** (SSE):
```json
{"type": "error", "message": "Could not fetch YouTube transcripts"}
```

---

## 🎓 What Makes This Unique

1. **Multi-Source Intelligence**
   - Amazon reviews (real user data)
   - YouTube transcripts (expert reviews)
   - Web search (context awareness)
   - LLM synthesis (expert analysis)

2. **Adaptive Weighting**
   - Derives scoring weights from query intent
   - Adjusts for data quality per product
   - Relative price scoring (vs absolute)

3. **Real-Time Streaming**
   - SSE for live progress
   - No polling, minimal latency
   - Transparent agent reasoning

4. **Dual Frontend**
   - React SPA for modern UX
   - Vanilla HTML for accessibility

5. **Human-in-Loop (CLI)**
   - Users can add/remove products
   - Validates additions via Amazon
   - API mode bypasses for automation

---

## 🚀 Deployment Notes

**Requirements**:
- Python 3.9+
- Node.js 18+ (for frontend dev/build)
- External APIs: OpenRouter, RapidAPI, YouTube, Tavily

**Run Backend**:
```bash
python -m uvicorn api:app --host 0.0.0.0 --port 8000
```

**Run Frontend** (dev):
```bash
cd frontend && npm run dev
```

**Build Frontend** (prod):
```bash
cd frontend && npm run build
# output: frontend/dist/
```

**Serve Static HTML**:
- Place `static/index.html` in `/static` directory
- Accessible at `http://localhost:8000/`

---

## 📝 Summary

**RONIN** is a sophisticated multi-agent system that combines:
- **Real data** (Amazon, YouTube)
- **Intelligence** (LLM analysis + adaptive scoring)
- **UX** (Real-time streaming, dual frontends)
- **Robustness** (Parallel execution, error recovery)

Perfect for product research where accuracy, transparency, and speed matter.
