<p align="center">
  <img src="public/img/fina.png" alt="FinaMeter Logo" width="120" />
</p>

<h1 align="center">FinaMeter</h1>

<p align="center">
  <strong>Master financial literacy through AI-powered quizzes on real market news.</strong>
</p>

<p align="center">
  <em>Built by <strong>Team Mental</strong> for the <a href="https://hacktheeast.com">Hack The East</a> hackathon</em>
</p>

<p align="center">
  <a href="#architecture">Architecture</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#database-schema">Database</a> &bull;
  <a href="#api-reference">API</a> &bull;
  <a href="#scalability">Scalability</a> &bull;
  <a href="#business-model">Business Model</a> &bull;
  <a href="#getting-started">Getting Started</a> &bull;
  <a href="#deployment">Deployment</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Railway-Deployed-0B0D0E?logo=railway&logoColor=white" alt="Railway" />
</p>

---

## Overview

FinaMeter is a gamified financial education platform that transforms real-time market news into interactive learning experiences. The system ingests articles from multiple financial data sources, processes them through an LLM pipeline to generate summaries, tutorials, and quizzes, then rewards users with XP, sector-specific skill gauges, and leaderboard rankings.

**How it works:** Articles flow in from Finnhub, GNews, and RSS feeds &rarr; an AI pipeline (OpenRouter) generates educational content and quiz questions &rarr; users read, learn, and test their knowledge &rarr; XP and gauge scores track mastery across financial sectors.

---

## Architecture

```
                        +------------------+
                        |    Next.js 16    |
                        |    Frontend      |
                        |  (React 19 + TS) |
                        +--------+---------+
                                 |
                          /api/v1/* proxy
                                 |
                        +--------v---------+
                        |    FastAPI        |
                        |    Backend        |
                        |  (Python 3.12)   |
                        +--+-----+------+--+
                           |     |      |
              +------------+     |      +-------------+
              |                  |                    |
     +--------v------+  +-------v-------+  +---------v--------+
     |   Supabase    |  |  OpenRouter   |  |  Market Data     |
     |  PostgreSQL   |  |  LLM API      |  |  Finnhub / Yahoo |
     |  + Auth       |  |  (MiniMax)    |  |  + WebSocket     |
     +--------------+   +---------------+  +------------------+
```

```
HackTheEast/
├── frontend/                 # Next.js App Router client
│   ├── src/
│   │   ├── app/              # Pages & routes
│   │   ├── components/       # 31 React components (by domain)
│   │   ├── hooks/            # useAuth, useNotifications, useTickerStream
│   │   ├── lib/              # API client, Supabase browser/server clients
│   │   └── types/            # TypeScript interfaces
│   └── package.json
│
├── backend/                  # FastAPI async server
│   ├── app/
│   │   ├── routers/          # 13 route modules (~1,260 LOC)
│   │   ├── services/         # Business logic (~1,880 LOC)
│   │   ├── models/           # Pydantic request/response schemas
│   │   ├── db/               # Supabase query builder (~730 LOC)
│   │   ├── scheduler/        # Background job orchestrator
│   │   ├── config.py         # Environment & settings
│   │   └── dependencies.py   # JWT auth & DI
│   ├── Dockerfile
│   └── requirements.txt
│
├── railway.toml              # Railway deployment config
└── public/                   # Static assets
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16, React 19, TypeScript 5 | App Router SSR/CSR hybrid |
| **Styling** | Tailwind CSS 4, Framer Motion | Dark theme UI with animations |
| **Charts** | Recharts 3 | Data visualization |
| **Backend** | FastAPI 0.115, Uvicorn, Python 3.12 | Async REST API + WebSocket |
| **Authentication** | Supabase Auth | Google OAuth + email/password, JWT sessions |
| **Database** | Supabase (PostgreSQL) | Storage, real-time, RPC functions |
| **AI/LLM** | OpenRouter API (MiniMax M2.5) | Content generation & quiz creation |
| **Market Data** | Finnhub API, Yahoo Finance | Stock quotes, financial news |
| **News** | GNews API, RSS (feedparser) | Multi-source article ingestion |
| **Scraping** | Trafilatura | Article body extraction |
| **Deployment** | Vercel (frontend), Railway (backend) | Edge CDN + containerized API |

---

## Features

### Content Pipeline
- **Multi-source ingestion** &mdash; Finnhub, GNews (by region & market), and configurable RSS feeds
- **Deduplication** &mdash; By Finnhub ID, GNews URL, and original article URL
- **AI processing** &mdash; Generates summaries, financial literacy tutorials, quiz questions, and sector tags
- **Structured lessons** &mdash; FLS v1 format with concept cards, mechanism maps, and asset impact matrices
- **Ticker extraction** &mdash; Links articles to stock symbols with live price data

### Quiz System
- **Per-article quizzes** &mdash; 3-5 MCQ questions generated by LLM with explanations
- **Real-time feedback** &mdash; Check individual answers before submitting
- **Daily quizzes** &mdash; Standalone daily challenge from top articles (once per user per day)
- **XP rewards** &mdash; Base XP + bonus per correct answer + streak multipliers

### Gamification
- **XP progression** &mdash; Earned through quizzes, daily challenges, predictions, and passive engagement
- **Sector gauges** &mdash; Skill score (0-100) per favorited sector ([details below](#sector-gauge-mechanics))
- **Streaks** &mdash; Consecutive daily activity tracking with milestone bonuses (+25 XP at 7 days, +100 XP at 30)
- **Leaderboards** &mdash; Global, weekly, monthly, by sector, and friends-only views (materialized views)

### Sector Gauge Mechanics

The gauge is FinaMeter's core feedback loop &mdash; a per-sector skill score from 0 to 100 that reflects how actively and accurately a user is learning within a financial domain.

```
    GAUGE LIFECYCLE

    User favorites a sector
            |
            v
    Gauge starts at 50
            |
     +------+------+
     |             |
  QUIZZES       INACTIVITY
  (gain)         (decay)
     |             |
     v             v
  +5 to +15    -5 to -15
  per quiz     every 30 min
     |             |
     +------+------+
            |
            v
    Clamped [20 .. 100]
            |
     Gauge = 100 ?
       +2 XP / 10 min (passive reward)
```

**Gain** &mdash; completing a quiz in that sector raises the gauge:

| Quiz Score | Gauge Points |
|-----------|-------------|
| Perfect (all correct) | +15 |
| Missed 1 | +12 |
| Missed 2 | +9 |
| Missed 3+ | +5 |

**Decay** &mdash; unread articles in a sector trigger automatic decay every 30 minutes:

| Pending Articles (last 24h) | Decay | Weekend |
|-----------------------------|-------|---------|
| 6+ unread | -15 | -7 |
| 4-5 unread | -10 | -5 |
| 2-3 unread | -5 | -2 |
| 0-1 unread | 0 | 0 |

Gauge never drops below **20** (floor), so users always have a foothold to recover.

**Why it matters:**
- **Honest skill signal** &mdash; Unlike XP which only goes up, the gauge penalizes neglect. A high gauge means you are *currently* engaged, not just historically active.
- **Drives daily return** &mdash; Decay creates gentle urgency to keep learning before your score erodes.
- **Passive XP at 100** &mdash; Maintaining a perfect gauge rewards +2 XP every 10 minutes, incentivizing mastery.
- **Sector leaderboards** &mdash; Gauge-derived XP feeds sector-specific rankings, making competition meaningful within each domain.
- **Subscription driver** &mdash; Free users can only track 3 sector gauges; upgrading unlocks unlimited sectors.

### Stock Prediction Game
- **Daily stock pool** &mdash; 5 actively traded stocks selected each trading day
- **Directional bets** &mdash; Predict UP or DOWN before market close
- **Automated resolution** &mdash; Background job resolves predictions at 4:05 PM ET using closing prices
- **XP rewards** &mdash; +50 XP per correct prediction

### Social
- **Friends** &mdash; Request/accept system with search and friend-only leaderboards
- **Activity feed** &mdash; Cursor-paginated feed of friends' quiz completions and milestones
- **Reactions** &mdash; Emoji reactions on activity items
- **Notifications** &mdash; Friend requests, quiz unlocks, streak milestones, weekly reports

### Market Data
- **Real-time quotes** &mdash; WebSocket proxy to Finnhub with HTTP fallback to Yahoo Finance
- **Ticker badges** &mdash; Inline stock price & change display on articles
- **Index tracking** &mdash; S&P 500, Dow Jones, and other major indices

### Weekly Reports
- **Automated generation** &mdash; Every Monday at 06:00 UTC
- **Performance summary** &mdash; Quizzes completed, XP earned, top sectors, best articles
- **AI insights** &mdash; LLM-generated analysis of learning patterns

---

## Database Schema

23 tables across 7 domains:

```
CONTENT                        LEARNING                     GAMIFICATION
───────────────                ────────────                 ──────────────
articles                       quizzes                      user_favorites
├── article_sectors            ├── quiz_questions             (gauge_score)
├── article_tickers            └── quiz_attempts            leaderboard_global
└── sectors                    daily_quizzes                leaderboard_weekly
                               └── daily_quiz_attempts      leaderboard_monthly
                                                            leaderboard_sector

PREDICTIONS                    SOCIAL                       SYSTEM
──────────────                 ───────────                  ─────────
predictions                    friendships                  notifications
daily_stocks                   activity_feed                weekly_reports
stock_pool                     activity_reactions           profiles
```

**Key relationships:**
- `articles` &harr; `sectors` via `article_sectors` (many-to-many)
- `articles` &rarr; `article_tickers` (one-to-many, stock symbols)
- `quizzes` &rarr; `quiz_questions` (one-to-many, 1 quiz per article)
- `user_favorites` tracks per-user, per-sector gauge scores (0-100)
- Leaderboards are **materialized views** refreshed every 5 minutes via RPC

**Stored procedures:**
- `increment_xp(uid, amount)` &mdash; Atomic XP update
- `refresh_leaderboards()` &mdash; Rebuilds all leaderboard views

---

## API Reference

Base path: `/api/v1`

### Articles
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/articles` | No | List articles (paginated, filterable by sector/category) |
| `GET` | `/articles/feed` | Yes | Personalized feed based on favorite sectors |
| `GET` | `/articles/headlines` | No | Hero + trending + world + markets |
| `GET` | `/articles/{id}` | No | Article detail with sectors & tickers |

### Quizzes
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/articles/{id}/quiz` | Yes | Get quiz for an article |
| `POST` | `/articles/{id}/quiz/check` | Yes | Check single answer (real-time feedback) |
| `POST` | `/articles/{id}/quiz/submit` | Yes | Submit full quiz, receive XP |

### Daily Quiz
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/daily-quiz` | Yes | Get today's daily quiz |
| `POST` | `/daily-quiz/submit` | Yes | Submit answers |

### Profile & Favorites
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/profile` | Yes | Dashboard (profile, streak, rank, favorites, activity) |
| `PUT` | `/profile` | Yes | Update display name / username / avatar |
| `GET` | `/favorites` | Yes | Favorite sectors with gauge scores |
| `POST` | `/favorites/{sector_id}` | Yes | Add favorite (gauge starts at 50) |
| `DELETE` | `/favorites/{sector_id}` | Yes | Remove favorite |

### Leaderboard
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/leaderboard/global` | No | Global rankings (`?period=all_time\|weekly\|monthly`) |
| `GET` | `/leaderboard/me` | Yes | Current user's rank |
| `GET` | `/leaderboard/friends` | Yes | Friend-only leaderboard |
| `GET` | `/leaderboard/sector/{slug}` | No | Sector-specific rankings |

### Predictions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/predict/today` | Yes | Today's stock pool with prices |
| `POST` | `/predict/predict` | Yes | Place UP/DOWN prediction |
| `GET` | `/predict/history` | Yes | Prediction history |
| `GET` | `/predict/results` | Yes | Resolved predictions with outcomes |

### Social
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/friends` | Yes | Accepted friends list |
| `POST` | `/friends/request/{user_id}` | Yes | Send friend request |
| `POST` | `/friends/accept/{id}` | Yes | Accept request |
| `GET` | `/feed` | Yes | Activity feed (cursor-paginated) |
| `POST` | `/feed/{id}/reactions` | Yes | Add emoji reaction |

### Market
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/market/quotes` | No | Stock/index prices (`?symbols=AAPL,MSFT`) |
| `WS` | `/market/ws` | No | Real-time quote stream |

### System
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | No | Health check with active background tasks |
| `GET` | `/sectors` | No | List all sectors |
| `GET` | `/notifications` | Yes | User notifications (paginated) |
| `GET` | `/weekly-reports` | Yes | User's weekly report history |

---

## Background Jobs

The scheduler runs as async tasks within the FastAPI lifespan:

| Job | Interval | Description |
|-----|----------|-------------|
| Article ingestion (Finnhub) | 5-30 min (adaptive) | Faster during market hours (9 AM-4 PM ET) |
| GNews regions | 4 hours | News by region (Asia, Americas, Europe, etc.) |
| GNews markets | 4 hours | Finance & market news |
| RSS feeds | 30 min | Configurable financial RSS sources |
| Process pending articles | 2 min | LLM pipeline for new articles (batch of 15) |
| Leaderboard refresh | 5 min | Rebuild materialized views |
| Gauge decay | 30 min | Reduce scores for inactive sectors (min 20) |
| Passive XP | 10 min | +2 XP for users with gauge at 100 |
| Resolve predictions | Daily 21:05 UTC | Compare closing prices, award XP |
| Notification cleanup | Daily 03:00 UTC | Remove expired notifications |
| Weekly reports | Monday 06:00 UTC | Generate summaries with AI insights |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Python** >= 3.12
- **Supabase** project ([create one](https://supabase.com/dashboard))
- API keys: [Finnhub](https://finnhub.io/), [GNews](https://gnews.io/), [OpenRouter](https://openrouter.ai/)

### 1. Clone

```bash
git clone https://github.com/your-username/FinaMeter.git
cd FinaMeter
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
FINNHUB_API_KEY=your-finnhub-key
GNEWS_API_KEY=your-gnews-key
OPENROUTER_API_KEY=your-openrouter-key
ALLOWED_ORIGINS=http://localhost:3000
```

Run the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Run the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Database

Set up the required tables and materialized views in your Supabase project. The schema is documented in the [Database Schema](#database-schema) section. Key RPC functions to create:

```sql
-- Atomic XP increment
CREATE OR REPLACE FUNCTION increment_xp(uid UUID, amount INT)
RETURNS VOID AS $$
  UPDATE profiles SET total_xp = total_xp + amount WHERE id = uid;
$$ LANGUAGE sql;

-- Refresh all leaderboard materialized views
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW leaderboard_global;
  REFRESH MATERIALIZED VIEW leaderboard_weekly;
  REFRESH MATERIALIZED VIEW leaderboard_monthly;
  REFRESH MATERIALIZED VIEW leaderboard_sector;
END;
$$ LANGUAGE plpgsql;
```

---

## Deployment

### Backend (Railway)

The backend deploys via Docker on Railway:

```toml
# railway.toml
[build]
builder = "dockerfile"
dockerfilePath = "backend/Dockerfile"
watchPatterns = ["backend/**"]

[deploy]
healthcheckPath = "/api/v1/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

Set environment variables in Railway dashboard, then deploy:

```bash
railway up
```

### Frontend

Deploy the `frontend/` directory to Vercel, Netlify, or any Node.js host:

```bash
cd frontend
npm run build
npm start
```

Set `NEXT_PUBLIC_API_URL` to your deployed backend URL.

---

## Environment Variables

| Variable | Required | Where | Description |
|----------|----------|-------|-------------|
| `SUPABASE_URL` | Yes | Backend | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Backend | Service role key (server-side only) |
| `SUPABASE_JWT_SECRET` | Yes | Backend | JWT verification secret |
| `FINNHUB_API_KEY` | Yes | Backend | Finnhub market data API key |
| `GNEWS_API_KEY` | Yes | Backend | GNews article API key |
| `OPENROUTER_API_KEY` | Yes | Backend | OpenRouter LLM API key |
| `ALLOWED_ORIGINS` | Yes | Backend | CORS origins (comma-separated) |
| `RESEND_API_KEY` | No | Backend | Email notifications via Resend |
| `DEBUG` | No | Backend | Enable debug mode |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Frontend | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Frontend | Supabase anonymous/public key |
| `NEXT_PUBLIC_API_URL` | Yes | Frontend | Backend API base URL |

---

## Scalability

FinaMeter is architected for growth from hackathon prototype to production platform:

| Concern | Current Approach | Production Path |
|---------|-----------------|-----------------|
| **Compute** | Single FastAPI instance on Railway | Horizontal scaling behind a load balancer; stateless design means any instance can serve any request |
| **Database** | Supabase managed PostgreSQL | Supabase scales vertically with plan upgrades; materialized views already offload leaderboard reads |
| **Background jobs** | In-process async tasks | Migrate to dedicated workers (Celery / BullMQ) with a Redis broker for independent scaling |
| **LLM processing** | Synchronous per-article | Batch queue with concurrency limits and dead-letter retry; swap models via OpenRouter without code changes |
| **Real-time data** | WebSocket proxy (Finnhub) | Dedicated WebSocket gateway with connection pooling and fan-out |
| **Content ingestion** | Multi-source polling loops | Add sources by dropping in a new adapter; deduplication layer is source-agnostic |
| **Caching** | None (DB-direct) | Redis/Valkey layer for hot paths (leaderboards, market quotes, article lists) |

**Sustainability by design:**
- **Async-first** &mdash; Every I/O operation is non-blocking, maximizing throughput per instance
- **Materialized views** &mdash; Leaderboard queries hit pre-computed views, not live aggregations
- **Adaptive scheduling** &mdash; Ingestion frequency scales with market hours (5 min during trading, 30 min overnight) to minimize API costs
- **Batch processing** &mdash; Articles processed in batches of 15 with automatic retry for failed items
- **Decay mechanics** &mdash; Gauge decay and passive XP run as lightweight background sweeps, not per-request calculations

---

## Business Model

FinaMeter follows a **freemium-to-subscription** model designed to convert engaged learners into paying subscribers:

### Free Tier
- Access to all articles and AI-generated summaries
- Quizzes on up to **3 favorited sectors**
- Daily quiz and stock prediction game
- Global leaderboard visibility
- Basic weekly report (stats only)

### Pro Subscription
| Feature | Free | Pro |
|---------|------|-----|
| Favorited sectors | 3 | Unlimited |
| Sector-specific quizzes & tutorials | Limited | Full access across all sectors |
| Weekly report | Basic stats | Personalized AI insights, revision quizzes, learning recommendations |
| Gauge tracking | 3 sectors | All sectors with detailed analytics |
| Leaderboard | Global only | Global + sector + friends |
| Content | Standard articles | Priority access to new articles + advanced FLS lessons |

### Revenue Drivers
- **Sector unlock paywall** &mdash; Free users can only favorite and track gauge scores for 3 sectors. Subscription removes the cap, unlocking quizzes, tutorials, and gauge tracking for all 20+ sectors (crypto, forex, bonds, commodities, regional markets, etc.)
- **Personalized weekly reports** &mdash; Pro subscribers receive AI-generated weekly reports with tailored revision quizzes targeting their weakest areas, performance trends, and actionable learning recommendations
- **Retention loop** &mdash; Streak bonuses, gauge decay, and social features (friend leaderboards, activity feed) create daily engagement habits that drive long-term subscription retention

### Growth Path
1. **Hackathon launch** &rarr; Validate core learning loop with early users
2. **Open beta** &rarr; Grow free tier, measure engagement and sector interest distribution
3. **Subscription launch** &rarr; Gate advanced sectors and personalized reports behind Pro
4. **B2B expansion** &rarr; White-label for financial institutions, universities, and corporate training programs

---

## License

This project was built for the [Hack The East](https://hacktheeast.com) hackathon.
