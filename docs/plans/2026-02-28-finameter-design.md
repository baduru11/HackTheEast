# FinaMeter — Design Document

**Date:** 2026-02-28
**Status:** Approved

---

## 1. Overview

FinaMeter is a financial news learning platform that aggregates news from multiple sources, generates AI-powered summaries and tutorials, and gamifies financial literacy through MCQ quizzes and a sector-based gauge system. Users stay current on financial news while building knowledge, tracked through XP, streaks, and leaderboards.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) + Tailwind CSS |
| Backend | FastAPI + asyncio |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (Email/Password + Google OAuth) |
| Realtime | Supabase Realtime (notifications) |
| News (US/Markets) | Finnhub API (free tier, 60 calls/min) |
| News (International) | GNews API (free tier, 100 calls/day) |
| Price Streaming | Finnhub WebSocket |
| Article Scraping | Trafilatura |
| LLM | MiniMax M2.5 via OpenRouter |
| Frontend Hosting | Vercel |
| Backend Hosting | Railway |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│                  Next.js (Vercel)                            │
│   ┌──────────┬──────────┬───────────┬──────────────────┐    │
│   │  Home    │ Sector   │  Article  │  Profile/Quiz    │    │
│   │  Feed    │  Feed    │  Detail   │  Dashboard       │    │
│   └────┬─────┴────┬─────┴─────┬─────┴────────┬─────────┘    │
│        └──────────┴─────┬─────┴──────────────┘               │
│                   next.config.js rewrites                     │
│                   /api/v1/* -> FastAPI                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                   FastAPI (Railway)                           │
│                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │
│   │ News Ingestion│  │ LLM Pipeline │  │  Quiz/Gauge    │   │
│   │ Service       │  │ Service      │  │  Service       │   │
│   │              │  │              │  │                │   │
│   │ • Finnhub WS │  │ • OpenRouter │  │ • Quiz CRUD    │   │
│   │ • Finnhub REST│─▶│ • Summary    │─▶│ • Gauge calc   │   │
│   │ • GNews API  │  │ • Tutorial   │  │ • XP/Leaderboard│  │
│   │ • Trafilatura│  │ • MCQ gen    │  │ • Notifications│   │
│   └──────────────┘  └──────────────┘  └────────────────┘   │
│                                                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    Supabase                                   │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│   │PostgreSQL │  │   Auth   │  │ Realtime │  │  Storage  │  │
│   │          │  │Google+   │  │WebSocket │  │  (images) │  │
│   │          │  │Email     │  │          │  │           │  │
│   └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. News Ingestion Pipeline

### Strategy: WebSocket-First + Adaptive Polling

**Primary — Finnhub WebSocket (instant):**
- Subscribe to news channel alongside trades channel
- When a news event arrives, immediately save metadata and trigger scrape + LLM pipeline
- Zero API call cost, real-time delivery

**Backup — Finnhub Adaptive REST Polling:**

| Time Window | Interval | Rationale |
|-------------|----------|-----------|
| Market hours (9:30 AM - 4 PM ET) | Every 5 min | Breaking news matters most |
| Pre/post market (7-9:30 AM, 4-8 PM ET) | Every 10 min | Moderate activity |
| Off hours (8 PM - 7 AM ET) | Every 30 min | Low activity |

**Daily Finnhub call budget:**

| Window | Hours | Cycles | Calls/cycle | Total |
|--------|-------|--------|-------------|-------|
| Market hours | 6.5 | 78 | ~44 | 3,432 |
| Pre/post market | 4.5 | 27 | ~44 | 1,188 |
| Off hours | 11 | 22 | ~20 | 440 |
| **Total** | | | | **~5,060/day** (under 86,400 limit) |

**Finnhub endpoints per cycle:**
- `/news?category=general` — 1 call
- `/news?category=forex` — 1 call
- `/news?category=crypto` — 1 call
- `/news?category=merger` — 1 call
- `/company-news` for top ~20 tickers — 20 calls
- `/quote` for mentioned tickers — ~20 calls
- Buffer: ~16 calls spare

**Secondary — GNews API (international coverage):**

| Query | Search Terms |
|-------|-------------|
| Asia | "asia finance OR economy" |
| Europe | "europe finance OR economy" |
| India | "india finance OR economy" |
| China | "china finance OR economy" |
| Japan | "japan finance OR economy" |
| Americas | "americas finance OR economy" |
| War | "war sanctions economy impact" |

- Polls every 2 hours, 7 queries per cycle
- 7 queries x 12 cycles/day = **84 calls/day** (under 100 limit)
- Returns 10 articles per request = up to 840 international articles/day

**Deduplication:** Check `finnhub_id` / `gnews_url` / `original_url` against existing articles before inserting.

### Trafilatura Scraping

Triggered after new articles are saved:
- Parallel scraping with 4 threads using Trafilatura's built-in `buffered_downloads`
- Config: `no_fallback=True`, `favor_precision=True`, `include_comments=False`, `output_format="json"`, `with_metadata=True`
- Returns `None` on failure — mark article as `"failed"`, retry once later

### LLM Processing (MiniMax M2.5 via OpenRouter)

- Single call per article with JSON mode enabled
- Generates: summary (3-4 paragraphs), financial tutorial, 3-5 MCQ questions
- Output validated with Pydantic on FastAPI side (no strict JSON Schema support)
- Strip `<think>` tags from output (mandatory reasoning tokens, ~30-50% overhead)
- Cost: ~$1.20/day for 1000 articles

---

## 5. Database Schema

```sql
-- USERS (extends Supabase auth.users)
profiles
  id              uuid PRIMARY KEY (FK -> auth.users)
  username        text UNIQUE
  display_name    text
  avatar_url      text
  total_xp        int DEFAULT 0
  created_at      timestamptz
  updated_at      timestamptz

-- SECTORS & USER FAVORITES
sectors
  id              serial PRIMARY KEY
  name            text                    -- e.g. "Crypto", "Asia"
  category        enum("world","markets")
  slug            text UNIQUE             -- e.g. "crypto", "asia"

user_favorites
  user_id         uuid (FK -> profiles)
  sector_id       int (FK -> sectors)
  gauge_score     int DEFAULT 50          -- 0-100
  gauge_updated_at timestamptz
  PRIMARY KEY (user_id, sector_id)

-- ARTICLES & CONTENT
articles
  id              serial PRIMARY KEY
  finnhub_id      text UNIQUE NULLABLE
  gnews_url       text UNIQUE NULLABLE
  source_name     text
  headline        text
  snippet         text
  original_url    text
  image_url       text NULLABLE
  author          text NULLABLE
  published_at    timestamptz
  language        text DEFAULT 'en'
  raw_content     text                    -- trafilatura scraped body
  ai_summary      text                    -- LLM-generated summary
  ai_tutorial     text                    -- LLM-generated financial lesson
  processing_status enum("pending","scraping","generating","done","failed")
  created_at      timestamptz
  updated_at      timestamptz

article_sectors                           -- many-to-many
  article_id      int (FK -> articles)
  sector_id       int (FK -> sectors)
  PRIMARY KEY (article_id, sector_id)

article_tickers
  article_id      int (FK -> articles)
  ticker          text                    -- e.g. "AAPL"
  price           numeric NULLABLE
  price_change_pct numeric NULLABLE
  PRIMARY KEY (article_id, ticker)

-- QUIZZES
quizzes
  id              serial PRIMARY KEY
  article_id      int (FK -> articles)
  created_at      timestamptz

quiz_questions
  id              serial PRIMARY KEY
  quiz_id         int (FK -> quizzes)
  question_text   text
  options         jsonb                   -- ["A", "B", "C", "D"]
  correct_index   int                     -- 0-3
  explanation     text
  order_num       int

-- USER QUIZ ATTEMPTS
quiz_attempts
  id              serial PRIMARY KEY
  user_id         uuid (FK -> profiles)
  quiz_id         int (FK -> quizzes)
  score           int
  total_questions int
  xp_earned       int
  completed_at    timestamptz
  UNIQUE (user_id, quiz_id)               -- one attempt per quiz

-- NOTIFICATIONS
notifications
  id              serial PRIMARY KEY
  user_id         uuid (FK -> profiles)
  type            enum("new_article","gauge_decay","achievement")
  title           text
  body            text
  link            text NULLABLE
  read            boolean DEFAULT false
  created_at      timestamptz
  expires_at      timestamptz

-- LEADERBOARDS (materialized views, refreshed every 5 min)
leaderboard_global
  -> SELECT id, username, avatar_url, total_xp, RANK() OVER (ORDER BY total_xp DESC)
     FROM profiles ORDER BY total_xp DESC LIMIT 100

leaderboard_sector
  -> SELECT user_id, sector_id, username, avatar_url, SUM(xp_earned) as sector_xp,
     RANK() OVER (PARTITION BY sector_id ORDER BY SUM(xp_earned) DESC)
     FROM quiz_attempts JOIN quizzes JOIN article_sectors JOIN profiles
     GROUP BY user_id, sector_id LIMIT 100
```

**Key decisions:**
- `quiz_attempts` UNIQUE on `(user_id, quiz_id)` — one attempt per quiz, no retakes
- `article_tickers` stores price snapshots at ingestion time
- `processing_status` tracks pipeline progress and enables retry on failure
- Leaderboards as materialized views — refreshed every 5 min, avoids expensive queries

---

## 6. Gamification System

### Gauge Meter (per sector, per user)

```
Starting value:     50 (on favorite selection)
Cap:                100 (max)

EARNING:
  Quiz completed:   +10 (scaled by score)
    5/5 correct     = +10
    4/5 correct     = +8
    3/5 correct     = +6
    below 3         = +3 (participation reward)

DECAY:
  New article in sector (after 30 min grace period):
    -5 per unread article (max 3 pending = -15)
    Floor: never drops below 20

  Daily inactivity:
    Day 1 missed    = -3
    Day 2 missed    = -5
    Day 3+ missed   = -8/day
    Floor: never drops below 10

SAFETY NETS:
  1 free "Freeze" per week (earned by completing 5+ quizzes that week)
  "Catch-up quiz" — answer any 3 pending quizzes to cancel decay
  Weekend: decay rate halved
```

### XP System

```
Quiz completion:          +10 XP base (same scaling as gauge)
Gauge at 100 bonus:       +2 XP per 10 min (passive, while gauge = 100)
First quiz of the day:    +5 XP bonus
7-day streak:             +25 XP bonus
30-day streak:            +100 XP bonus

XP is permanent — never decays. Lifetime achievement score.
Gauge is temporary — "current readiness" in a sector.
```

### Leaderboards

- **Global:** Top 100 users by total XP
- **Per-sector:** Top 100 users by XP earned in that sector
- Both are materialized views, refreshed every 5 min

---

## 7. API Endpoints

```
AUTH
  POST   /api/v1/auth/callback          Handle OAuth callback
  GET    /api/v1/auth/me                 Get current user profile

ARTICLES
  GET    /api/v1/articles                Paginated feed (?sector=&category=&page=&limit=)
  GET    /api/v1/articles/headlines      Home page hero + trending
  GET    /api/v1/articles/:id            Full article detail
  GET    /api/v1/articles/:id/tickers    Ticker data for article

SECTORS
  GET    /api/v1/sectors                 All sectors with categories

QUIZZES (authenticated)
  GET    /api/v1/articles/:id/quiz       Get quiz questions
  POST   /api/v1/articles/:id/quiz       Submit answers -> returns score, xp, gauge change

USER PROFILE (authenticated)
  GET    /api/v1/profile                 Dashboard data (xp, streak, rank)
  PUT    /api/v1/profile                 Update display name, avatar

FAVORITES & GAUGES (authenticated)
  GET    /api/v1/favorites               User's sectors + gauge scores
  POST   /api/v1/favorites              Add sector to favorites
  DELETE /api/v1/favorites/:sector_id    Remove favorite
  GET    /api/v1/favorites/pending       Pending quizzes across all favorites

LEADERBOARD
  GET    /api/v1/leaderboard             Global top 100
  GET    /api/v1/leaderboard/:sector     Per-sector top 100
  GET    /api/v1/leaderboard/me          Current user's rank (authenticated)

NOTIFICATIONS (authenticated)
  GET    /api/v1/notifications           Paginated notifications
  PATCH  /api/v1/notifications/:id       Mark as read
  POST   /api/v1/notifications/read-all  Mark all as read

LIVE DATA
  WS     /api/v1/ws/ticker               Proxied Finnhub price stream

INTERNAL (not exposed to frontend)
  POST   /api/v1/internal/ingest         Trigger news ingestion cycle
  POST   /api/v1/internal/decay          Trigger gauge decay calculation
  POST   /api/v1/internal/refresh-lb     Refresh leaderboard materialized views
```

**Authentication flow:**
1. User clicks "Login with Google" on Next.js frontend
2. Supabase Auth handles OAuth, returns JWT in session cookie
3. Next.js passes JWT in Authorization header to FastAPI
4. FastAPI middleware validates JWT using Supabase JWT secret

**Response format:**
```json
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 142 } }
{ "success": false, "error": { "code": "QUIZ_ALREADY_COMPLETED", "message": "..." } }
```

---

## 8. Frontend Pages

```
/                           Home (headline news grid from all sectors)
/world                      World sector landing
/world/[slug]               Subsector feed (e.g., /world/asia)
/markets                    Markets sector landing
/markets/[slug]             Subsector feed (e.g., /markets/crypto)
/article/[id]               Article detail (summary, tutorial, quiz link)
/article/[id]/quiz          MCQ quiz page
/leaderboard                Global + sector leaderboards
/login                      Login/signup page
/profile                    User dashboard (favorites, gauges, XP, streaks)
/profile/onboarding         Sector selection (post-signup)
```

### Navbar

```
FinaMeter          World v      Markets v      Bell  Login/Avatar
                   Asia         Crypto
                   Americas     Stocks
                   Europe       Options
                   India        Bonds
                   China        Currency
                   Japan        ETFs
                   War          Indices
                                Sector
```

### Sectors

**World:** Asia, Americas, Europe, India, China, Japan, War
**Markets:** Crypto, Stocks, Options, Bonds, Currency, ETFs, World Indices, Sector

### Design Direction
- Dark theme primary (financial apps convention)
- Accent color: teal/cyan for gauge meters and highlights
- Cards with subtle borders, no heavy shadows
- Mobile-first responsive design
- Live ticker bar with smooth scrolling animation (Finnhub WebSocket)

---

## 9. Project Structure

```
FinaMeter/
├── frontend/                          Next.js (Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               Home
│   │   │   ├── login/page.tsx
│   │   │   ├── world/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   ├── markets/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   ├── article/[id]/
│   │   │   │   ├── page.tsx
│   │   │   │   └── quiz/page.tsx
│   │   │   ├── leaderboard/page.tsx
│   │   │   └── profile/
│   │   │       ├── page.tsx
│   │   │       └── onboarding/page.tsx
│   │   ├── components/
│   │   │   ├── layout/               Navbar, NavDropdown, TickerBar, Footer
│   │   │   ├── home/                 HeroCard, TrendingGrid, SectorPreview
│   │   │   ├── feed/                 ArticleCard, ArticleList
│   │   │   ├── article/              ArticleHeader, TickerBadges, SummaryTab, TutorialTab
│   │   │   ├── quiz/                 QuizCard, QuizOption, QuizResults
│   │   │   ├── profile/              GaugeMeter, SectorCard, XPDisplay, StreakBadge
│   │   │   ├── leaderboard/          LeaderboardTable, SectorTabs
│   │   │   └── ui/                   NotificationBell, NotificationPanel, LoadMore
│   │   ├── lib/
│   │   │   ├── supabase/             client.ts, server.ts
│   │   │   ├── api.ts                Typed fetch wrapper for FastAPI
│   │   │   └── utils.ts
│   │   ├── hooks/                    useNotifications, useTickerStream, useAuth
│   │   └── types/index.ts
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                           FastAPI (Railway)
│   ├── app/
│   │   ├── main.py                    App entry, middleware
│   │   ├── config.py                  Environment variables
│   │   ├── dependencies.py            Auth middleware, DB session
│   │   ├── routers/
│   │   │   ├── articles.py
│   │   │   ├── quizzes.py
│   │   │   ├── profile.py
│   │   │   ├── favorites.py
│   │   │   ├── leaderboard.py
│   │   │   ├── notifications.py
│   │   │   └── websocket.py
│   │   ├── services/
│   │   │   ├── finnhub.py             Finnhub API + WebSocket client
│   │   │   ├── gnews.py               GNews API client
│   │   │   ├── scraper.py             Trafilatura scraping logic
│   │   │   ├── llm.py                 OpenRouter / MiniMax calls
│   │   │   ├── gauge.py               Gauge calculation + decay
│   │   │   ├── xp.py                  XP + streak logic
│   │   │   └── notifications.py       Notification dispatch
│   │   ├── models/
│   │   │   ├── article.py             Pydantic models
│   │   │   ├── quiz.py
│   │   │   ├── user.py
│   │   │   └── llm_output.py          LLM response validation
│   │   ├── scheduler/
│   │   │   └── jobs.py                APScheduler: ingest, decay, leaderboard
│   │   └── db/
│   │       └── supabase.py            Supabase client wrapper
│   ├── requirements.txt
│   ├── Dockerfile
│   └── railway.toml
│
└── docs/
    └── plans/
        └── 2026-02-28-finameter-design.md
```

**Key decisions:**
- No ORM — use Supabase Python client (`supabase-py`) directly
- APScheduler for cron jobs (adaptive polling, decay every 10 min, leaderboard refresh every 5 min)
- Pydantic models validate API request/response and LLM output
- Components organized by feature, not by type

---

## 10. Scheduler Summary

| Job | Frequency | Description |
|-----|-----------|-------------|
| Finnhub REST poll | Adaptive (5/10/30 min) | Backup news ingestion |
| GNews poll | Every 2 hours | International news (7 queries) |
| Gauge decay | Every 10 min | Calculate and apply gauge decay |
| Passive XP | Every 10 min | Award +2 XP to users with gauge at 100 |
| Leaderboard refresh | Every 5 min | Refresh materialized views |
| Notification cleanup | Daily | Delete expired notifications |

---

## 11. Rate Limit Budget

| Source | Limit | Usage | Headroom |
|--------|-------|-------|----------|
| Finnhub REST | 60 calls/min (86,400/day) | ~5,060/day | 94% spare |
| Finnhub WebSocket | Unlimited (free tier) | Continuous | N/A |
| GNews API | 100 calls/day | 84/day | 16% spare |
| OpenRouter (MiniMax M2.5) | Pay-per-use | ~$1.20/day for 1000 articles | N/A |

---

## 12. Flags & Risks

1. **Finnhub WebSocket news on free tier** — trade WebSocket is confirmed free, news WebSocket needs verification during implementation. If unavailable, adaptive REST polling alone is sufficient.
2. **Finnhub Company Profile v2** — moved to premium. P/E ratio and market cap may need an alternative source or be dropped from MVP.
3. **GNews free tier** — 10 articles per request. Sufficient for MVP but may need upgrade for comprehensive coverage.
4. **Supabase free tier realtime** — 200 concurrent connections, 100 messages/sec. Fine for launch, monitor as user base grows.
5. **Trafilatura failures** — some news sites block scraping. Implement retry once, then mark as failed and serve headline + snippet only.
