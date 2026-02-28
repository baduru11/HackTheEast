# Daily Quiz & Predict — Design Document

**Date:** 2026-03-01
**Status:** Approved

---

## Overview

Two new features for FinaMeter:

1. **Daily Quiz** (`/daily-quiz`) — Standalone daily quiz with 5 questions generated from trending news. 10 XP per correct answer.
2. **Predict** (`/predict`) — Stock prediction game where users predict if stocks go up or down, resolved at market close. 50 XP per correct prediction.

---

## Architecture

### Backend (FastAPI)

- New router: `daily_quiz.py` — generates quiz from trending articles, handles submissions
- New router: `predict.py` — manages predictions, stock pool, resolution
- New service: `predict.py` — stock pool management, random selection, prediction logic, market close resolution
- Extend existing `finnhub.py` — add candle/history data for stock charts

### Frontend (Next.js)

- New page: `src/app/daily-quiz/page.tsx`
- New page: `src/app/predict/page.tsx`
- New components: `StockPredictionCard`, `PredictionHistory`, `StockDetailModal`, `CelebrationOverlay`

### Database (Supabase)

- New tables: `daily_quizzes`, `daily_quiz_attempts`, `stock_pool`, `daily_stocks`, `predictions`

---

## Daily Quiz

### Database

- `daily_quizzes`: `id`, `date` (unique, one per day), `questions` (JSONB array of 5 questions), `source_article_ids`, `created_at`
- `daily_quiz_attempts`: `id`, `user_id`, `quiz_id`, `answers` (JSONB), `score`, `xp_earned`, `completed_at`

### API Endpoints (`/api/v1/daily-quiz`)

- `GET /today` — Returns today's quiz. If none exists, generates one using recent trending articles + LLM service.
- `POST /submit` — Submits answers, calculates score, awards XP (10 per correct), logs activity for social feed.

### Quiz Generation Flow

1. Check if today's quiz exists in `daily_quizzes`
2. If not, fetch 5 recent trending articles from DB
3. Send article summaries to LLM service with MCQ prompt (4 options + explanation per question)
4. Store in `daily_quizzes`, return to user

### Key Decisions

- One quiz per day — all users get the same quiz
- Users can only attempt each daily quiz once (unique constraint on `user_id` + `quiz_id`)
- XP awards go through existing `xp.py` service
- Activity logged via existing `activity.py` for social feed

---

## Predict

### Database

- `stock_pool`: `ticker`, `name`, `logo_url`, `active` (boolean) — ~50 famous stocks (AAPL, TSLA, NVDA, MSFT, AMZN, GOOGL, META, JPM, V, DIS, etc.)
- `daily_stocks`: `id`, `date` (unique), `tickers` (array of 5 randomly selected), `created_at`
- `predictions`: `id`, `user_id`, `date`, `ticker`, `direction` (up/down), `price_at_bet`, `price_at_close`, `result` (pending/win/loss), `xp_earned`, `created_at`, `resolved_at`

### API Endpoints (`/api/v1/predict`)

- `GET /today` — Returns today's 5 stocks with live prices from Finnhub. Generates random selection if none exists for today.
- `GET /stock/{ticker}/candles` — Returns candle data for chart (1D/7D/30D/90D) via Finnhub.
- `POST /predict` — Places a prediction (direction + current price snapshot). One prediction per stock per day.
- `GET /my-predictions` — User's prediction history with results.
- `POST /resolve` — Scheduler-triggered: at market close, fetches closing prices, resolves pending predictions, awards 50 XP for wins.

### Resolution Flow

1. APScheduler job runs at ~16:05 EST (after market close)
2. Fetches closing prices for all tickers with pending predictions
3. Compares `price_at_close` vs `price_at_bet`
4. Updates `result` to win/loss, awards XP, logs activity

### Key Decisions

- 5 stocks randomly selected daily from pool — same for all users
- One prediction per stock per day per user
- Prices fetched live from Finnhub, no caching of stale prices
- Scheduler reuses existing APScheduler setup in `scheduler/jobs.py`

---

## Frontend

### Daily Quiz Page (`/daily-quiz`)

- States: Loading → Quiz (question-by-question) → Results
- Progress bar showing question 1/5, 2/5, etc.
- Each question: question text, 4 option buttons, confirm button
- After answering: highlight correct/wrong, show explanation
- Results screen: score (e.g. 4/5), total XP earned, "Come back tomorrow" message

### Predict Page (`/predict`)

- Hero section with title and brief explanation
- 5 stock cards in a grid — ticker, name, live price, 24h change
- Click card → StockDetailModal with price chart (Recharts) and stats
- Predict buttons: "Going Up" / "Going Down" with confirmation step
- After predicting: card shows "Awaiting result" state
- Prediction history section below — past predictions with win/loss/pending
- CelebrationOverlay on correct prediction resolution

### New Components

- `StockPredictionCard` — stock card with predict buttons
- `StockDetailModal` — chart + stats modal (Recharts)
- `PredictionHistory` — list of past predictions
- `CelebrationOverlay` — celebration animation on wins

### Navigation

- Add "Daily Quiz" and "Predict" links to existing Navbar

---

## Integration Points

### Existing services reused (no modification):

- `xp.py` — XP awarding for both features
- `activity.py` — Social feed logging
- `finnhub.py` — Live stock quotes
- `llm.py` — Quiz question generation
- `scheduler/jobs.py` — Add prediction resolution job

### Finnhub extension:

- Add helper for `/stock/candle` endpoint — needed for stock detail charts

### Frontend dependency to add:

- `recharts` — stock price charts in detail modal

### No changes to:

- Existing article quiz system (`/article/[id]/quiz`)
- Existing leaderboard (XP flows in naturally via `xp.py`)
- Existing social feed (activities logged automatically)
- Auth system

### Database migrations (4 total):

1. Create `stock_pool` table + seed ~50 tickers
2. Create `daily_stocks` table
3. Create `predictions` table
4. Create `daily_quizzes` and `daily_quiz_attempts` tables
