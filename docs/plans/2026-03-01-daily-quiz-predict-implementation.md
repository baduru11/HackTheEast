# Daily Quiz & Predict Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two new features — Daily Quiz (`/daily-quiz`) and Predict (`/predict`) — with FastAPI backend endpoints and Next.js frontend pages.

**Architecture:** New FastAPI routers + services for both features, extending existing Finnhub/LLM/XP services. Frontend pages adapted from frontend2 reference code, styled to match existing dark/glass/teal theme.

**Tech Stack:** FastAPI, Supabase (PostgreSQL), Next.js 16, React 19, Tailwind CSS, Framer Motion, Recharts

---

## Task 1: Database Migrations

**Goal:** Create all required tables in Supabase.

**Step 1: Apply migration for stock_pool and daily_stocks tables**

Use Supabase MCP `apply_migration` with project ID. SQL:

```sql
-- Stock pool: ~50 famous tickers for random daily selection
CREATE TABLE IF NOT EXISTS stock_pool (
  ticker TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily stock selection: 5 random stocks per day
CREATE TABLE IF NOT EXISTS daily_stocks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  tickers TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed stock pool with ~50 famous tickers
INSERT INTO stock_pool (ticker, name) VALUES
  ('AAPL', 'Apple'), ('MSFT', 'Microsoft'), ('GOOGL', 'Alphabet'),
  ('AMZN', 'Amazon'), ('NVDA', 'NVIDIA'), ('META', 'Meta'),
  ('TSLA', 'Tesla'), ('BRK.B', 'Berkshire Hathaway'), ('JPM', 'JPMorgan'),
  ('V', 'Visa'), ('JNJ', 'Johnson & Johnson'), ('WMT', 'Walmart'),
  ('PG', 'Procter & Gamble'), ('MA', 'Mastercard'), ('UNH', 'UnitedHealth'),
  ('HD', 'Home Depot'), ('DIS', 'Disney'), ('BAC', 'Bank of America'),
  ('ADBE', 'Adobe'), ('CRM', 'Salesforce'), ('NFLX', 'Netflix'),
  ('AMD', 'AMD'), ('INTC', 'Intel'), ('CSCO', 'Cisco'),
  ('PEP', 'PepsiCo'), ('KO', 'Coca-Cola'), ('COST', 'Costco'),
  ('TMO', 'Thermo Fisher'), ('AVGO', 'Broadcom'), ('ABT', 'Abbott'),
  ('MRK', 'Merck'), ('LLY', 'Eli Lilly'), ('ORCL', 'Oracle'),
  ('ACN', 'Accenture'), ('TXN', 'Texas Instruments'), ('QCOM', 'Qualcomm'),
  ('NKE', 'Nike'), ('SBUX', 'Starbucks'), ('PYPL', 'PayPal'),
  ('BA', 'Boeing'), ('GS', 'Goldman Sachs'), ('MS', 'Morgan Stanley'),
  ('CAT', 'Caterpillar'), ('DE', 'Deere'), ('UBER', 'Uber'),
  ('SQ', 'Block'), ('SNAP', 'Snap'), ('COIN', 'Coinbase'),
  ('PLTR', 'Palantir'), ('RIVN', 'Rivian')
ON CONFLICT (ticker) DO NOTHING;
```

**Step 2: Apply migration for predictions table**

```sql
CREATE TABLE IF NOT EXISTS predictions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  ticker TEXT NOT NULL REFERENCES stock_pool(ticker),
  direction TEXT NOT NULL CHECK (direction IN ('up', 'down')),
  price_at_bet NUMERIC NOT NULL,
  price_at_close NUMERIC,
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'win', 'loss')),
  xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(user_id, date, ticker)
);

CREATE INDEX idx_predictions_user_date ON predictions(user_id, date);
CREATE INDEX idx_predictions_pending ON predictions(result) WHERE result = 'pending';
```

**Step 3: Apply migration for daily_quizzes and daily_quiz_attempts tables**

```sql
CREATE TABLE IF NOT EXISTS daily_quizzes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  questions JSONB NOT NULL,
  source_article_ids INTEGER[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_quiz_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  quiz_id BIGINT NOT NULL REFERENCES daily_quizzes(id),
  answers JSONB NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 5,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, quiz_id)
);
```

**Step 4: Enable RLS on new tables**

```sql
ALTER TABLE stock_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- stock_pool: public read
CREATE POLICY "stock_pool_read" ON stock_pool FOR SELECT USING (true);

-- daily_stocks: public read
CREATE POLICY "daily_stocks_read" ON daily_stocks FOR SELECT USING (true);

-- predictions: users read own, service role inserts
CREATE POLICY "predictions_read_own" ON predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "predictions_insert_own" ON predictions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- daily_quizzes: public read
CREATE POLICY "daily_quizzes_read" ON daily_quizzes FOR SELECT USING (true);

-- daily_quiz_attempts: users read own
CREATE POLICY "daily_quiz_attempts_read_own" ON daily_quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_quiz_attempts_insert_own" ON daily_quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**Step 5: Commit**

```bash
git add docs/plans/
git commit -m "feat: add database migrations for daily quiz and predict features"
```

---

## Task 2: Backend Pydantic Models

**Files:**
- Create: `backend/app/models/daily_quiz.py`
- Create: `backend/app/models/predict.py`

**Step 1: Create daily quiz models**

Create `backend/app/models/daily_quiz.py`:

```python
from pydantic import BaseModel


class DailyQuizQuestion(BaseModel):
    question_text: str
    options: list[str]
    correct_index: int
    explanation: str
    source_article_id: int | None = None


class DailyQuizOut(BaseModel):
    id: int
    date: str
    questions: list[dict]  # stripped of correct_index


class DailyQuizSubmit(BaseModel):
    answers: list[int]


class DailyQuizResult(BaseModel):
    score: int
    total_questions: int
    xp_earned: int
    explanations: list[dict]
```

**Step 2: Create predict models**

Create `backend/app/models/predict.py`:

```python
from pydantic import BaseModel, field_validator


class StockOut(BaseModel):
    ticker: str
    name: str
    price: float
    change_24h: float


class PredictionCreate(BaseModel):
    ticker: str
    direction: str
    price_at_bet: float

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v: str) -> str:
        if v not in ("up", "down"):
            raise ValueError("direction must be 'up' or 'down'")
        return v


class PredictionOut(BaseModel):
    id: int
    ticker: str
    stock_name: str
    direction: str
    price_at_bet: float
    price_at_close: float | None
    result: str
    xp_earned: int
    created_at: str


class TodayStocksOut(BaseModel):
    date: str
    stocks: list[StockOut]
```

**Step 3: Commit**

```bash
git add backend/app/models/daily_quiz.py backend/app/models/predict.py
git commit -m "feat: add pydantic models for daily quiz and predict"
```

---

## Task 3: Backend DB Functions

**Files:**
- Modify: `backend/app/db/supabase.py` (append new functions at end)

**Step 1: Add daily quiz DB functions**

Append to `backend/app/db/supabase.py`:

```python
# ── Daily Quiz ──────────────────────────────────────────────

async def get_daily_quiz_by_date(date_str: str):
    result = supabase.table("daily_quizzes").select("*").eq("date", date_str).maybe_single().execute()
    return result.data


async def insert_daily_quiz(date_str: str, questions: list[dict], source_article_ids: list[int]):
    result = supabase.table("daily_quizzes").insert({
        "date": date_str,
        "questions": questions,
        "source_article_ids": source_article_ids,
    }).execute()
    return result.data[0] if result.data else None


async def get_daily_quiz_attempt(user_id: str, quiz_id: int):
    result = (
        supabase.table("daily_quiz_attempts")
        .select("*")
        .eq("user_id", user_id)
        .eq("quiz_id", quiz_id)
        .maybe_single()
        .execute()
    )
    return result.data


async def insert_daily_quiz_attempt(user_id: str, quiz_id: int, answers: list[int], score: int, total: int, xp_earned: int):
    result = supabase.table("daily_quiz_attempts").insert({
        "user_id": user_id,
        "quiz_id": quiz_id,
        "answers": answers,
        "score": score,
        "total_questions": total,
        "xp_earned": xp_earned,
    }).execute()
    return result.data[0] if result.data else None
```

**Step 2: Add predict DB functions**

Append to `backend/app/db/supabase.py`:

```python
# ── Predict (Stock Predictions) ────────────────────────────

async def get_active_stock_pool():
    result = supabase.table("stock_pool").select("ticker, name").eq("active", True).execute()
    return result.data or []


async def get_daily_stocks(date_str: str):
    result = supabase.table("daily_stocks").select("*").eq("date", date_str).maybe_single().execute()
    return result.data


async def insert_daily_stocks(date_str: str, tickers: list[str]):
    result = supabase.table("daily_stocks").insert({
        "date": date_str,
        "tickers": tickers,
    }).execute()
    return result.data[0] if result.data else None


async def get_user_prediction(user_id: str, date_str: str, ticker: str):
    result = (
        supabase.table("predictions")
        .select("*")
        .eq("user_id", user_id)
        .eq("date", date_str)
        .eq("ticker", ticker)
        .maybe_single()
        .execute()
    )
    return result.data


async def insert_prediction(user_id: str, date_str: str, ticker: str, direction: str, price_at_bet: float):
    result = supabase.table("predictions").insert({
        "user_id": user_id,
        "date": date_str,
        "ticker": ticker,
        "direction": direction,
        "price_at_bet": price_at_bet,
    }).execute()
    return result.data[0] if result.data else None


async def get_user_predictions(user_id: str, limit: int = 20):
    result = (
        supabase.table("predictions")
        .select("*, stock_pool(name)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


async def get_pending_predictions():
    result = (
        supabase.table("predictions")
        .select("*")
        .eq("result", "pending")
        .execute()
    )
    return result.data or []


async def resolve_prediction(prediction_id: int, price_at_close: float, result: str, xp_earned: int):
    from datetime import datetime, timezone
    supabase.table("predictions").update({
        "price_at_close": price_at_close,
        "result": result,
        "xp_earned": xp_earned,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", prediction_id).execute()
```

**Step 3: Commit**

```bash
git add backend/app/db/supabase.py
git commit -m "feat: add DB functions for daily quiz and predict"
```

---

## Task 4: Backend Daily Quiz Service & Router

**Files:**
- Create: `backend/app/services/daily_quiz.py`
- Create: `backend/app/routers/daily_quiz.py`

**Step 1: Create daily quiz service**

Create `backend/app/services/daily_quiz.py`:

```python
import json
import logging
from datetime import date, timezone, datetime

from app.db import supabase as db
from app.services.llm import generate_daily_quiz_questions

logger = logging.getLogger(__name__)


async def get_or_create_daily_quiz():
    today = date.today().isoformat()

    existing = await db.get_daily_quiz_by_date(today)
    if existing:
        return existing

    # Fetch 5 recent processed articles for quiz material
    articles, _ = await db.get_articles(status="done", limit=5)
    if not articles:
        raise ValueError("No processed articles available for daily quiz")

    article_texts = []
    article_ids = []
    for a in articles:
        headline = a.get("headline", "")
        summary = a.get("ai_summary", "") or a.get("snippet", "")
        if headline and summary:
            article_texts.append(f"Headline: {headline}\nSummary: {summary}")
            article_ids.append(a["id"])

    if len(article_texts) < 3:
        raise ValueError("Not enough article content for daily quiz")

    questions = await generate_daily_quiz_questions(article_texts)

    quiz = await db.insert_daily_quiz(today, questions, article_ids)
    return quiz
```

**Step 2: Add LLM function for daily quiz generation**

Append to `backend/app/services/llm.py` (after existing functions):

```python
async def generate_daily_quiz_questions(article_texts: list[str]) -> list[dict]:
    combined = "\n\n---\n\n".join(article_texts)

    prompt = f"""Based on the following financial news articles, generate exactly 5 multiple-choice quiz questions.

Articles:
{combined}

Return a JSON array of 5 objects, each with:
- "question_text": the question string
- "options": array of exactly 4 answer strings
- "correct_index": integer 0-3 indicating correct answer
- "explanation": brief explanation of why the answer is correct

Focus on testing understanding of:
- Key facts from the articles
- Financial concepts mentioned
- Market implications
- Cause and effect relationships

Return ONLY the JSON array, no other text."""

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "minimax/minimax-m2.5",
        "messages": [
            {"role": "system", "content": "You are a financial education quiz generator. Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(OPENROUTER_URL, headers=headers, json=payload)
        resp.raise_for_status()

    content = resp.json()["choices"][0]["message"]["content"]
    parsed = json.loads(content)

    # Handle both {"questions": [...]} and direct array
    if isinstance(parsed, dict) and "questions" in parsed:
        questions = parsed["questions"]
    elif isinstance(parsed, list):
        questions = parsed
    else:
        raise ValueError("Unexpected LLM response format")

    return questions[:5]
```

**Step 3: Create daily quiz router**

Create `backend/app/routers/daily_quiz.py`:

```python
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.db import supabase as db
from app.models.daily_quiz import DailyQuizSubmit
from app.services.daily_quiz import get_or_create_daily_quiz
from app.services.xp import calculate_quiz_xp
from app.services.activity import record_activity

router = APIRouter(prefix="/api/v1/daily-quiz", tags=["daily-quiz"])


@router.get("/today")
async def get_today_quiz():
    try:
        quiz = await get_or_create_daily_quiz()
    except ValueError as e:
        return {"success": False, "error": {"code": "NO_QUIZ", "message": str(e)}}

    # Strip correct answers for client
    safe_questions = []
    for q in quiz["questions"]:
        safe_questions.append({
            "question_text": q["question_text"],
            "options": q["options"],
        })

    return {
        "success": True,
        "data": {
            "id": quiz["id"],
            "date": quiz["date"],
            "questions": safe_questions,
        },
    }


@router.post("/submit")
async def submit_daily_quiz(
    body: DailyQuizSubmit,
    user_id: str = Depends(get_current_user),
):
    from datetime import date

    today = date.today().isoformat()
    quiz = await db.get_daily_quiz_by_date(today)
    if not quiz:
        return {"success": False, "error": {"code": "NO_QUIZ", "message": "No quiz available today"}}

    # Check if already attempted
    existing = await db.get_daily_quiz_attempt(user_id, quiz["id"])
    if existing:
        return {"success": False, "error": {"code": "QUIZ_ALREADY_COMPLETED", "message": "You already completed today's quiz"}}

    questions = quiz["questions"]
    if len(body.answers) != len(questions):
        return {"success": False, "error": {"code": "INVALID_ANSWERS", "message": f"Expected {len(questions)} answers"}}

    # Grade
    score = 0
    explanations = []
    for i, q in enumerate(questions):
        is_correct = body.answers[i] == q["correct_index"]
        if is_correct:
            score += 1
        explanations.append({
            "question_text": q["question_text"],
            "your_answer": body.answers[i],
            "correct_answer": q["correct_index"],
            "is_correct": is_correct,
            "explanation": q["explanation"],
        })

    # XP: 10 per correct answer
    xp_earned = score * 10

    # Save attempt
    await db.insert_daily_quiz_attempt(user_id, quiz["id"], body.answers, score, len(questions), xp_earned)

    # Award XP
    if xp_earned > 0:
        await db.add_xp(user_id, xp_earned)

    # Log activity
    await record_activity(user_id, "daily_quiz_completed", {
        "score": score,
        "total": len(questions),
        "xp_earned": xp_earned,
    })

    return {
        "success": True,
        "data": {
            "score": score,
            "total_questions": len(questions),
            "xp_earned": xp_earned,
            "explanations": explanations,
        },
    }
```

**Step 4: Commit**

```bash
git add backend/app/services/daily_quiz.py backend/app/routers/daily_quiz.py backend/app/services/llm.py
git commit -m "feat: add daily quiz service and router"
```

---

## Task 5: Backend Predict Service & Router

**Files:**
- Create: `backend/app/services/predict.py`
- Create: `backend/app/routers/predict.py`

**Step 1: Create predict service**

Create `backend/app/services/predict.py`:

```python
import random
import logging
from datetime import date

from app.db import supabase as db
from app.services import finnhub

logger = logging.getLogger(__name__)


async def get_or_create_daily_stocks() -> dict:
    today = date.today().isoformat()

    existing = await db.get_daily_stocks(today)
    if existing:
        return existing

    # Get active pool and randomly select 5
    pool = await db.get_active_stock_pool()
    if len(pool) < 5:
        raise ValueError("Not enough stocks in pool")

    selected = random.sample(pool, 5)
    tickers = [s["ticker"] for s in selected]

    record = await db.insert_daily_stocks(today, tickers)
    return record


async def get_today_stocks_with_prices() -> list[dict]:
    daily = await get_or_create_daily_stocks()
    tickers = daily["tickers"]

    pool = await db.get_active_stock_pool()
    ticker_names = {s["ticker"]: s["name"] for s in pool}

    stocks = []
    for ticker in tickers:
        try:
            quote = await finnhub.get_quote(ticker)
            stocks.append({
                "ticker": ticker,
                "name": ticker_names.get(ticker, ticker),
                "price": quote.get("c", 0),
                "change_24h": quote.get("dp", 0),
            })
        except Exception as e:
            logger.warning(f"Failed to fetch quote for {ticker}: {e}")
            stocks.append({
                "ticker": ticker,
                "name": ticker_names.get(ticker, ticker),
                "price": 0,
                "change_24h": 0,
            })

    return stocks


async def resolve_pending_predictions():
    pending = await db.get_pending_predictions()
    if not pending:
        logger.info("No pending predictions to resolve")
        return

    # Group by ticker to minimize API calls
    tickers = list({p["ticker"] for p in pending})
    closing_prices = {}
    for ticker in tickers:
        try:
            quote = await finnhub.get_quote(ticker)
            closing_prices[ticker] = quote.get("c", 0)
        except Exception as e:
            logger.error(f"Failed to fetch closing price for {ticker}: {e}")

    resolved_count = 0
    for pred in pending:
        ticker = pred["ticker"]
        if ticker not in closing_prices or closing_prices[ticker] == 0:
            continue

        close_price = closing_prices[ticker]
        bet_price = float(pred["price_at_bet"])

        if pred["direction"] == "up":
            won = close_price > bet_price
        else:
            won = close_price < bet_price

        result = "win" if won else "loss"
        xp = 50 if won else 0

        await db.resolve_prediction(pred["id"], close_price, result, xp)

        if xp > 0:
            await db.add_xp(pred["user_id"], xp)

        resolved_count += 1

    logger.info(f"Resolved {resolved_count} predictions")
```

**Step 2: Add Finnhub helper functions**

Append to `backend/app/services/finnhub.py` (after existing functions):

```python
async def get_quote(symbol: str) -> dict:
    """Fetch real-time quote for a single symbol."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://finnhub.io/api/v1/quote",
            params={"symbol": symbol, "token": settings.finnhub_api_key},
        )
        resp.raise_for_status()
        return resp.json()


async def get_candles(symbol: str, resolution: str, from_ts: int, to_ts: int) -> dict:
    """Fetch candle data for charting."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://finnhub.io/api/v1/stock/candle",
            params={
                "symbol": symbol,
                "resolution": resolution,
                "from": from_ts,
                "to": to_ts,
                "token": settings.finnhub_api_key,
            },
        )
        resp.raise_for_status()
        return resp.json()
```

Note: Check if `get_quote` already exists in `finnhub.py`. If a similar function exists, reuse it instead of adding a duplicate.

**Step 3: Create predict router**

Create `backend/app/routers/predict.py`:

```python
import time
from datetime import date
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.db import supabase as db
from app.models.predict import PredictionCreate
from app.services.predict import get_today_stocks_with_prices
from app.services import finnhub

router = APIRouter(prefix="/api/v1/predict", tags=["predict"])


@router.get("/today")
async def get_today():
    try:
        stocks = await get_today_stocks_with_prices()
    except ValueError as e:
        return {"success": False, "error": {"code": "NO_STOCKS", "message": str(e)}}

    return {
        "success": True,
        "data": {
            "date": date.today().isoformat(),
            "stocks": stocks,
        },
    }


@router.post("/predict")
async def place_prediction(
    body: PredictionCreate,
    user_id: str = Depends(get_current_user),
):
    today = date.today().isoformat()

    # Check if today's stock list includes this ticker
    daily = await db.get_daily_stocks(today)
    if not daily or body.ticker not in daily["tickers"]:
        return {"success": False, "error": {"code": "INVALID_TICKER", "message": "This stock is not in today's selection"}}

    # Check if already predicted this stock today
    existing = await db.get_user_prediction(user_id, today, body.ticker)
    if existing:
        return {"success": False, "error": {"code": "ALREADY_PREDICTED", "message": "You already predicted this stock today"}}

    prediction = await db.insert_prediction(user_id, today, body.ticker, body.direction, body.price_at_bet)

    return {
        "success": True,
        "data": prediction,
    }


@router.get("/my-predictions")
async def get_my_predictions(
    user_id: str = Depends(get_current_user),
    limit: int = 20,
):
    predictions = await db.get_user_predictions(user_id, limit)

    result = []
    for p in predictions:
        stock_name = p.get("stock_pool", {}).get("name", p["ticker"]) if p.get("stock_pool") else p["ticker"]
        result.append({
            "id": p["id"],
            "ticker": p["ticker"],
            "stock_name": stock_name,
            "direction": p["direction"],
            "price_at_bet": float(p["price_at_bet"]),
            "price_at_close": float(p["price_at_close"]) if p.get("price_at_close") else None,
            "result": p["result"],
            "xp_earned": p["xp_earned"],
            "created_at": p["created_at"],
        })

    return {"success": True, "data": result}


@router.get("/stock/{ticker}/candles")
async def get_stock_candles(ticker: str, range: str = "1D"):
    now = int(time.time())

    resolution_map = {
        "1D": ("5", 86400),
        "7D": ("15", 604800),
        "30D": ("60", 2592000),
        "90D": ("D", 7776000),
    }

    if range not in resolution_map:
        return {"success": False, "error": {"code": "INVALID_RANGE", "message": "Use 1D, 7D, 30D, or 90D"}}

    resolution, seconds = resolution_map[range]
    from_ts = now - seconds

    try:
        candles = await finnhub.get_candles(ticker, resolution, from_ts, now)
        return {"success": True, "data": candles}
    except Exception as e:
        return {"success": False, "error": {"code": "FETCH_ERROR", "message": str(e)}}
```

**Step 4: Commit**

```bash
git add backend/app/services/predict.py backend/app/routers/predict.py backend/app/services/finnhub.py
git commit -m "feat: add predict service and router with Finnhub integration"
```

---

## Task 6: Backend Scheduler & Router Registration

**Files:**
- Modify: `backend/app/scheduler/jobs.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/services/activity.py`

**Step 1: Add prediction resolution job to scheduler**

In `backend/app/scheduler/jobs.py`, add import at top:

```python
from app.services.predict import resolve_pending_predictions
```

Then add job inside `setup_scheduler()` function, alongside existing jobs:

```python
    # Resolve stock predictions at 16:05 ET (21:05 UTC) on weekdays
    scheduler.add_job(
        lambda: asyncio.get_event_loop().run_until_complete(resolve_pending_predictions()),
        "cron",
        hour=21,
        minute=5,
        day_of_week="mon-fri",
        id="resolve_predictions",
        replace_existing=True,
    )
```

**Step 2: Add activity recording helper for predict**

Append to `backend/app/services/activity.py`:

```python
async def record_activity(user_id: str, activity_type: str, metadata: dict):
    await db.insert_activity(user_id, activity_type, metadata)
```

Note: Check if a generic `record_activity` or `insert_activity` already exists. If `insert_activity` in `db` is already called directly, just use that in the daily quiz router instead.

**Step 3: Register new routers in main.py**

In `backend/app/main.py`, add imports:

```python
from app.routers import daily_quiz, predict
```

And register routers (after existing includes):

```python
app.include_router(daily_quiz.router)
app.include_router(predict.router)
```

**Step 4: Commit**

```bash
git add backend/app/scheduler/jobs.py backend/app/main.py backend/app/services/activity.py
git commit -m "feat: register daily quiz and predict routers, add prediction resolution scheduler"
```

---

## Task 7: Frontend Types & Dependencies

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/package.json` (install recharts)

**Step 1: Install recharts**

```bash
cd frontend && npm install recharts
```

**Step 2: Add new types**

Append to `frontend/src/types/index.ts`:

```typescript
// ── Daily Quiz ─────────────────────────────────────────────

export interface DailyQuizQuestion {
  question_text: string
  options: string[]
}

export interface DailyQuiz {
  id: number
  date: string
  questions: DailyQuizQuestion[]
}

export interface DailyQuizExplanation {
  question_text: string
  your_answer: number
  correct_answer: number
  is_correct: boolean
  explanation: string
}

export interface DailyQuizResult {
  score: number
  total_questions: number
  xp_earned: number
  explanations: DailyQuizExplanation[]
}

// ── Predict ────────────────────────────────────────────────

export interface PredictStock {
  ticker: string
  name: string
  price: number
  change_24h: number
}

export interface Prediction {
  id: number
  ticker: string
  stock_name: string
  direction: "up" | "down"
  price_at_bet: number
  price_at_close: number | null
  result: "pending" | "win" | "loss"
  xp_earned: number
  created_at: string
}
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: add types for daily quiz and predict, install recharts"
```

---

## Task 8: Frontend Daily Quiz Page

**Files:**
- Create: `frontend/src/app/daily-quiz/page.tsx`

**Step 1: Create the daily quiz page**

Create `frontend/src/app/daily-quiz/page.tsx`. This is a `"use client"` component with three states: loading, quiz (question-by-question), and results.

Key behavior:
- Fetch quiz from `GET /api/v1/daily-quiz/today`
- Show one question at a time with progress bar (1/5, 2/5, etc.)
- 4 option buttons (A, B, C, D) — user selects one, then confirms
- After confirming: show correct/incorrect + explanation, auto-advance after brief delay
- After all 5: submit answers via `POST /api/v1/daily-quiz/submit` with auth token
- Results screen: score, XP earned, per-question breakdown
- Handle `QUIZ_ALREADY_COMPLETED` error

Style conventions to follow:
- Dark bg (`bg-gray-950`), glass cards, teal accents
- `FadeInUp` / `StaggerList` from `@/components/shared/MotionWrappers`
- Framer Motion `AnimatePresence` for question transitions
- `useAuth()` hook for session/token
- `apiFetch()` or direct fetch with Bearer token
- Loading: `skeleton-shimmer` divs
- Max width container: `max-w-2xl mx-auto`

Adapt the UI from `frontend2/src/pages/QuizPage.tsx` but:
- Replace Supabase Edge Function calls with FastAPI endpoints
- Replace `useAuth()` balance/token system with existing XP system
- Use Next.js patterns (App Router, no React Router)
- Match existing styling (no shadcn, pure Tailwind + custom classes)

**Step 2: Commit**

```bash
git add frontend/src/app/daily-quiz/page.tsx
git commit -m "feat: add daily quiz frontend page"
```

---

## Task 9: Frontend Predict Page & Components

**Files:**
- Create: `frontend/src/app/predict/page.tsx`
- Create: `frontend/src/components/predict/StockPredictionCard.tsx`
- Create: `frontend/src/components/predict/PredictionHistory.tsx`
- Create: `frontend/src/components/predict/StockDetailModal.tsx`
- Create: `frontend/src/components/predict/CelebrationOverlay.tsx`

**Step 1: Create StockPredictionCard component**

Create `frontend/src/components/predict/StockPredictionCard.tsx`.

A card showing:
- Stock ticker + name
- Live price + 24h change (green/red)
- Two buttons: "Going Up" / "Going Down"
- Confirmation step before submitting
- "Awaiting result" state after prediction placed
- Click handler to open detail modal

Adapt from `frontend2/src/components/StockPredictionCard.tsx` but:
- Use `PredictStock` type from `@/types`
- Match existing card styling (glass, rounded-xl, border-gray-800)
- Teal accent for buttons/highlights
- Framer Motion hover effects

**Step 2: Create PredictionHistory component**

Create `frontend/src/components/predict/PredictionHistory.tsx`.

A list showing past predictions:
- Ticker, direction (up/down icon), price at bet
- Result: win (green check + XP), loss (red X), pending (clock)
- Staggered animation with `StaggerList`/`StaggerItem`

Adapt from `frontend2/src/components/PredictionHistory.tsx`.

**Step 3: Create StockDetailModal component**

Create `frontend/src/components/predict/StockDetailModal.tsx`.

Modal with:
- Stock price header with 24h change
- Time range tabs (1D, 7D, 30D, 90D)
- Recharts `AreaChart` showing price history
- Fetches candle data from `GET /api/v1/predict/stock/{ticker}/candles?range=1D`
- Close button, backdrop click to close

Adapt from `frontend2/src/components/StockDetailModal.tsx` but:
- Use FastAPI endpoint instead of Supabase Edge Function
- Match dark theme styling
- Use portal or fixed positioning for modal

**Step 4: Create CelebrationOverlay component**

Create `frontend/src/components/predict/CelebrationOverlay.tsx`.

Simple overlay:
- Dark backdrop with blur
- Congratulations text + XP earned
- Auto-dismiss after 3 seconds
- Framer Motion fade in/out

Adapt from `frontend2/src/components/CelebrationOverlay.tsx`. Remove GIF dependency — use emoji/text animation instead or keep GIF if available.

**Step 5: Create Predict page**

Create `frontend/src/app/predict/page.tsx`. A `"use client"` component.

Layout:
- Hero section: title "Predict", subtitle explaining the game
- 5 stock cards in responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- Below: Prediction history section
- StockDetailModal (conditionally rendered)
- CelebrationOverlay (conditionally rendered)

Data flow:
- Fetch today's stocks from `GET /api/v1/predict/today`
- Fetch user's predictions from `GET /api/v1/predict/my-predictions` (if authed)
- Submit prediction via `POST /api/v1/predict/predict` with auth token
- Track which stocks already have predictions (disable predict buttons)

Style conventions: same as Task 8 (dark, glass, teal, motion wrappers).

**Step 6: Commit**

```bash
git add frontend/src/app/predict/ frontend/src/components/predict/
git commit -m "feat: add predict page with stock cards, history, detail modal, and celebration overlay"
```

---

## Task 10: Navigation Updates

**Files:**
- Modify: `frontend/src/components/layout/Navbar.tsx`
- Modify: `frontend/src/app/page.tsx` (optional: add feature cards)

**Step 1: Add nav links for Daily Quiz and Predict**

In `frontend/src/components/layout/Navbar.tsx`, add two new links alongside existing Feed/Social/Leaderboard links:

```tsx
<Link href="/daily-quiz" className="...">Daily Quiz</Link>
<Link href="/predict" className="...">Predict</Link>
```

Add these in both desktop and mobile nav sections. Use the same styling pattern as existing links.

**Step 2: Optionally add feature cards on home page**

In `frontend/src/app/page.tsx`, consider adding quick-access cards for Daily Quiz and Predict in the hero or below trending section. This is optional.

**Step 3: Commit**

```bash
git add frontend/src/components/layout/Navbar.tsx
git commit -m "feat: add Daily Quiz and Predict links to navbar"
```

---

## Task 11: Final Integration & Verification

**Step 1: Start backend and verify endpoints**

```bash
cd backend && python -m uvicorn app.main:app --reload
```

Test endpoints manually:
- `GET http://localhost:8000/api/v1/daily-quiz/today` — should return quiz
- `GET http://localhost:8000/api/v1/predict/today` — should return 5 stocks with prices
- `GET http://localhost:8000/api/v1/predict/stock/AAPL/candles?range=1D` — should return candle data

**Step 2: Start frontend and verify pages**

```bash
cd frontend && npm run dev
```

Visit:
- `http://localhost:3000/daily-quiz` — quiz page loads, can answer questions
- `http://localhost:3000/predict` — stock cards load with prices
- Navbar shows new links

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete daily quiz and predict features integration"
```
