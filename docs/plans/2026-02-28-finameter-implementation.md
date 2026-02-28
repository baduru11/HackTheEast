# FinaMeter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a financial news learning platform with gamified MCQ quizzes, gauge meters, and leaderboards.

**Architecture:** Next.js frontend (Vercel) communicates with FastAPI backend (Railway) via rewrites. FastAPI ingests news from Finnhub + GNews, scrapes with Trafilatura, generates AI content via MiniMax M2.5 on OpenRouter, and stores everything in Supabase PostgreSQL. Supabase handles auth and realtime notifications.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS, FastAPI, asyncio, APScheduler, Supabase (PostgreSQL + Auth + Realtime), Finnhub API/WebSocket, GNews API, Trafilatura, OpenRouter (MiniMax M2.5)

**Supabase Project ID:** `zgusqjuuqmhzpjrkgxhg`

**Design Doc:** `docs/plans/2026-02-28-finameter-design.md`

---

## Phase 1: Database Schema & Backend Foundation

### Task 1: Database Schema — Core Tables

**Files:**
- Migration applied via Supabase MCP

**Step 1: Apply migration for enums and core tables**

Apply migration `create_core_tables` with this SQL:

```sql
-- Enums
CREATE TYPE sector_category AS ENUM ('world', 'markets');
CREATE TYPE processing_status AS ENUM ('pending', 'scraping', 'generating', 'done', 'failed');
CREATE TYPE notification_type AS ENUM ('new_article', 'gauge_decay', 'achievement');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  total_xp int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sectors
CREATE TABLE sectors (
  id serial PRIMARY KEY,
  name text NOT NULL,
  category sector_category NOT NULL,
  slug text UNIQUE NOT NULL
);

-- Seed sectors
INSERT INTO sectors (name, category, slug) VALUES
  ('Asia', 'world', 'asia'),
  ('Americas', 'world', 'americas'),
  ('Europe', 'world', 'europe'),
  ('India', 'world', 'india'),
  ('China', 'world', 'china'),
  ('Japan', 'world', 'japan'),
  ('War', 'world', 'war'),
  ('Crypto', 'markets', 'crypto'),
  ('Stocks', 'markets', 'stocks'),
  ('Options', 'markets', 'options'),
  ('Bonds', 'markets', 'bonds'),
  ('Currency', 'markets', 'currency'),
  ('ETFs', 'markets', 'etfs'),
  ('World Indices', 'markets', 'indices'),
  ('Sector', 'markets', 'sector');

-- User favorites
CREATE TABLE user_favorites (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sector_id int NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  gauge_score int NOT NULL DEFAULT 50 CHECK (gauge_score >= 0 AND gauge_score <= 100),
  gauge_updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sector_id)
);

-- Articles
CREATE TABLE articles (
  id serial PRIMARY KEY,
  finnhub_id text UNIQUE,
  gnews_url text UNIQUE,
  source_name text NOT NULL,
  headline text NOT NULL,
  snippet text,
  original_url text NOT NULL,
  image_url text,
  author text,
  published_at timestamptz,
  language text NOT NULL DEFAULT 'en',
  raw_content text,
  ai_summary text,
  ai_tutorial text,
  processing_status processing_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Article <-> Sector mapping
CREATE TABLE article_sectors (
  article_id int NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  sector_id int NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, sector_id)
);

-- Article tickers (price snapshot at ingestion)
CREATE TABLE article_tickers (
  article_id int NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  price numeric,
  price_change_pct numeric,
  PRIMARY KEY (article_id, ticker)
);

-- Quizzes
CREATE TABLE quizzes (
  id serial PRIMARY KEY,
  article_id int NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Quiz questions
CREATE TABLE quiz_questions (
  id serial PRIMARY KEY,
  quiz_id int NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_index int NOT NULL CHECK (correct_index >= 0 AND correct_index <= 3),
  explanation text NOT NULL,
  order_num int NOT NULL
);

-- Quiz attempts (one per user per quiz)
CREATE TABLE quiz_attempts (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id int NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score int NOT NULL,
  total_questions int NOT NULL,
  xp_earned int NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quiz_id)
);

-- Notifications
CREATE TABLE notifications (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 month')
);

-- Indexes
CREATE INDEX idx_articles_status ON articles(processing_status);
CREATE INDEX idx_articles_published ON articles(published_at DESC);
CREATE INDEX idx_article_sectors_sector ON article_sectors(sector_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, read, expires_at);
CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_user_favorites_user ON user_favorites(user_id);
```

**Step 2: Verify tables were created**

Run: `list_tables` on project `zgusqjuuqmhzpjrkgxhg` schema `public`
Expected: All 10 tables listed

**Step 3: Commit**

```bash
git add docs/
git commit -m "feat: apply core database schema migration"
```

---

### Task 2: Database Schema — RLS Policies & Materialized Views

**Files:**
- Migration applied via Supabase MCP

**Step 1: Apply migration for RLS policies**

Apply migration `add_rls_and_views` with this SQL:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_insert ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Sectors: everyone can read
CREATE POLICY sectors_select ON sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY sectors_select_anon ON sectors FOR SELECT TO anon USING (true);

-- Articles: everyone can read
CREATE POLICY articles_select ON articles FOR SELECT TO authenticated USING (true);
CREATE POLICY articles_select_anon ON articles FOR SELECT TO anon USING (true);

-- Article sectors: everyone can read
CREATE POLICY article_sectors_select ON article_sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY article_sectors_select_anon ON article_sectors FOR SELECT TO anon USING (true);

-- Article tickers: everyone can read
CREATE POLICY article_tickers_select ON article_tickers FOR SELECT TO authenticated USING (true);
CREATE POLICY article_tickers_select_anon ON article_tickers FOR SELECT TO anon USING (true);

-- Quizzes: everyone can read
CREATE POLICY quizzes_select ON quizzes FOR SELECT TO authenticated USING (true);
CREATE POLICY quizzes_select_anon ON quizzes FOR SELECT TO anon USING (true);

-- Quiz questions: everyone can read
CREATE POLICY quiz_questions_select ON quiz_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY quiz_questions_select_anon ON quiz_questions FOR SELECT TO anon USING (true);

-- Quiz attempts: users can read/insert own
CREATE POLICY quiz_attempts_select ON quiz_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY quiz_attempts_insert ON quiz_attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- User favorites: users can read/insert/update/delete own
CREATE POLICY favorites_select ON user_favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY favorites_insert ON user_favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY favorites_update ON user_favorites FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY favorites_delete ON user_favorites FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Notifications: users can read/update own
CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_update ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'preferred_username',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Materialized views for leaderboards
CREATE MATERIALIZED VIEW leaderboard_global AS
SELECT p.id as user_id, p.username, p.avatar_url, p.total_xp,
       RANK() OVER (ORDER BY p.total_xp DESC) as rank
FROM profiles p
WHERE p.total_xp > 0
ORDER BY p.total_xp DESC
LIMIT 100;

CREATE MATERIALIZED VIEW leaderboard_sector AS
SELECT qa.user_id, a_s.sector_id, p.username, p.avatar_url,
       SUM(qa.xp_earned)::int as sector_xp,
       RANK() OVER (PARTITION BY a_s.sector_id ORDER BY SUM(qa.xp_earned) DESC) as rank
FROM quiz_attempts qa
JOIN quizzes q ON q.id = qa.quiz_id
JOIN article_sectors a_s ON a_s.article_id = q.article_id
JOIN profiles p ON p.id = qa.user_id
GROUP BY qa.user_id, a_s.sector_id, p.username, p.avatar_url;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_lb_global_user ON leaderboard_global(user_id);
CREATE UNIQUE INDEX idx_lb_sector_user_sector ON leaderboard_sector(user_id, sector_id);
```

**Step 2: Run security advisors**

Run: `get_advisors` with type `security` on the project
Expected: No critical warnings about missing RLS

**Step 3: Commit**

```bash
git add docs/
git commit -m "feat: add RLS policies, auto-profile trigger, leaderboard views"
```

---

### Task 3: Backend Project Scaffold

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/main.py`
- Create: `backend/app/dependencies.py`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`

**Step 1: Create requirements.txt**

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
supabase==2.13.0
httpx==0.28.1
websockets==14.2
apscheduler==3.11.0
trafilatura==2.0.0
pydantic==2.10.5
pydantic-settings==2.7.1
python-jose[cryptography]==3.3.0
python-dotenv==1.0.1
finnhub-python==2.4.22
```

**Step 2: Create .env.example**

```
SUPABASE_URL=https://zgusqjuuqmhzpjrkgxhg.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
FINNHUB_API_KEY=your-finnhub-key
GNEWS_API_KEY=your-gnews-key
OPENROUTER_API_KEY=your-openrouter-key
```

**Step 3: Create config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    finnhub_api_key: str
    gnews_api_key: str
    openrouter_api_key: str

    class Config:
        env_file = ".env"


settings = Settings()
```

**Step 4: Create dependencies.py**

```python
from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError
from supabase import create_client

from app.config import settings

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


async def get_current_user(authorization: str = Header(...)) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(
    authorization: str | None = Header(None),
) -> str | None:
    if not authorization:
        return None
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None
```

**Step 5: Create main.py**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: scheduler will be added in Task 10
    yield
    # Shutdown


app = FastAPI(title="FinaMeter API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
```

**Step 6: Create __init__.py**

Empty file.

**Step 7: Verify the server starts**

Run: `cd backend && pip install -r requirements.txt && python -m uvicorn app.main:app --port 8000`
Expected: Server starts, `GET /api/v1/health` returns `{"status": "ok"}`

Note: You need a `.env` file with real keys to start. Create one from `.env.example` first. If keys aren't available yet, set dummy values and verify the import/startup structure works.

**Step 8: Commit**

```bash
git add backend/
git commit -m "feat: scaffold FastAPI backend with config, auth, and health endpoint"
```

---

### Task 4: Pydantic Models

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/article.py`
- Create: `backend/app/models/quiz.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/llm_output.py`

**Step 1: Create article.py**

```python
from pydantic import BaseModel
from datetime import datetime


class ArticleBase(BaseModel):
    source_name: str
    headline: str
    snippet: str | None = None
    original_url: str
    image_url: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    language: str = "en"


class ArticleCreate(ArticleBase):
    finnhub_id: str | None = None
    gnews_url: str | None = None


class ArticleOut(ArticleBase):
    id: int
    ai_summary: str | None = None
    ai_tutorial: str | None = None
    processing_status: str
    created_at: datetime
    sectors: list[str] = []


class ArticleDetail(ArticleOut):
    raw_content: str | None = None
    tickers: list["TickerOut"] = []


class TickerOut(BaseModel):
    ticker: str
    price: float | None = None
    price_change_pct: float | None = None


class ArticleListResponse(BaseModel):
    success: bool = True
    data: list[ArticleOut]
    meta: dict


class HeadlinesResponse(BaseModel):
    success: bool = True
    data: dict  # {"hero": ArticleOut, "trending": list[ArticleOut], "world": list, "markets": list}
```

**Step 2: Create quiz.py**

```python
from pydantic import BaseModel
from datetime import datetime


class QuestionOut(BaseModel):
    id: int
    question_text: str
    options: list[str]
    order_num: int


class QuestionWithAnswer(QuestionOut):
    correct_index: int
    explanation: str


class QuizOut(BaseModel):
    id: int
    article_id: int
    questions: list[QuestionOut]


class QuizSubmit(BaseModel):
    answers: list[int]


class QuizResult(BaseModel):
    success: bool = True
    data: "QuizResultData"


class QuizResultData(BaseModel):
    score: int
    total_questions: int
    xp_earned: int
    gauge_change: int
    new_gauge_score: int
    explanations: list["QuestionFeedback"]


class QuestionFeedback(BaseModel):
    question_text: str
    your_answer: int
    correct_answer: int
    is_correct: bool
    explanation: str
```

**Step 3: Create user.py**

```python
from pydantic import BaseModel
from datetime import datetime


class ProfileOut(BaseModel):
    id: str
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    total_xp: int
    created_at: datetime


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    username: str | None = None
    avatar_url: str | None = None


class DashboardOut(BaseModel):
    profile: ProfileOut
    streak_days: int
    global_rank: int | None = None
    favorites: list["FavoriteOut"]
    recent_activity: list["ActivityOut"]


class FavoriteOut(BaseModel):
    sector_id: int
    sector_name: str
    sector_slug: str
    gauge_score: int
    pending_quizzes: int


class ActivityOut(BaseModel):
    description: str
    xp_earned: int
    completed_at: datetime


class LeaderboardEntry(BaseModel):
    user_id: str
    username: str | None = None
    avatar_url: str | None = None
    xp: int
    rank: int


class SectorOut(BaseModel):
    id: int
    name: str
    category: str
    slug: str
```

**Step 4: Create llm_output.py**

```python
from pydantic import BaseModel, field_validator
import re


class LLMQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: str

    @field_validator("options")
    @classmethod
    def validate_options(cls, v):
        if len(v) != 4:
            raise ValueError("Must have exactly 4 options")
        return v

    @field_validator("correct_index")
    @classmethod
    def validate_correct_index(cls, v):
        if v < 0 or v > 3:
            raise ValueError("correct_index must be 0-3")
        return v


class LLMArticleOutput(BaseModel):
    summary: str
    tutorial: str
    questions: list[LLMQuestion]
    sectors: list[str]

    @field_validator("questions")
    @classmethod
    def validate_questions(cls, v):
        if len(v) < 3 or len(v) > 5:
            raise ValueError("Must have 3-5 questions")
        return v

    @classmethod
    def from_raw_response(cls, raw: str) -> "LLMArticleOutput":
        cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
        return cls.model_validate_json(cleaned)
```

**Step 5: Create __init__.py**

Empty file.

**Step 6: Commit**

```bash
git add backend/app/models/
git commit -m "feat: add Pydantic models for articles, quizzes, users, LLM output"
```

---

### Task 5: Supabase DB Client Wrapper

**Files:**
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/supabase.py`

**Step 1: Create supabase.py**

```python
from datetime import datetime

from app.dependencies import supabase


# --- Articles ---

async def get_articles(
    sector: str | None = None,
    category: str | None = None,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
):
    query = supabase.table("articles").select(
        "*, article_sectors(sector_id, sectors(name, slug, category))",
        count="exact",
    )

    if status:
        query = query.eq("processing_status", status)
    else:
        query = query.eq("processing_status", "done")

    if sector:
        sector_row = supabase.table("sectors").select("id").eq("slug", sector).single().execute()
        if sector_row.data:
            article_ids = supabase.table("article_sectors").select("article_id").eq("sector_id", sector_row.data["id"]).execute()
            ids = [r["article_id"] for r in article_ids.data]
            if ids:
                query = query.in_("id", ids)
            else:
                return [], 0
    elif category:
        sector_rows = supabase.table("sectors").select("id").eq("category", category).execute()
        sector_ids = [r["id"] for r in sector_rows.data]
        article_ids = supabase.table("article_sectors").select("article_id").in_("sector_id", sector_ids).execute()
        ids = list(set(r["article_id"] for r in article_ids.data))
        if ids:
            query = query.in_("id", ids)
        else:
            return [], 0

    offset = (page - 1) * limit
    result = query.order("published_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data, result.count


async def get_article_by_id(article_id: int):
    result = supabase.table("articles").select(
        "*, article_sectors(sector_id, sectors(name, slug)), article_tickers(*)"
    ).eq("id", article_id).single().execute()
    return result.data


async def insert_article(data: dict) -> int:
    result = supabase.table("articles").insert(data).execute()
    return result.data[0]["id"]


async def update_article(article_id: int, data: dict):
    supabase.table("articles").update(data).eq("id", article_id).execute()


async def article_exists(finnhub_id: str | None = None, gnews_url: str | None = None, original_url: str | None = None) -> bool:
    if finnhub_id:
        result = supabase.table("articles").select("id").eq("finnhub_id", finnhub_id).execute()
        if result.data:
            return True
    if gnews_url:
        result = supabase.table("articles").select("id").eq("gnews_url", gnews_url).execute()
        if result.data:
            return True
    if original_url:
        result = supabase.table("articles").select("id").eq("original_url", original_url).execute()
        if result.data:
            return True
    return False


async def insert_article_sectors(article_id: int, sector_ids: list[int]):
    rows = [{"article_id": article_id, "sector_id": sid} for sid in sector_ids]
    supabase.table("article_sectors").insert(rows).execute()


async def insert_article_tickers(article_id: int, tickers: list[dict]):
    rows = [{"article_id": article_id, **t} for t in tickers]
    supabase.table("article_tickers").insert(rows).execute()


# --- Quizzes ---

async def insert_quiz(article_id: int, questions: list[dict]) -> int:
    quiz = supabase.table("quizzes").insert({"article_id": article_id}).execute()
    quiz_id = quiz.data[0]["id"]
    for i, q in enumerate(questions):
        supabase.table("quiz_questions").insert({
            "quiz_id": quiz_id,
            "question_text": q["question"],
            "options": q["options"],
            "correct_index": q["correct_index"],
            "explanation": q["explanation"],
            "order_num": i + 1,
        }).execute()
    return quiz_id


async def get_quiz_by_article(article_id: int):
    result = supabase.table("quizzes").select(
        "*, quiz_questions(*)"
    ).eq("article_id", article_id).single().execute()
    return result.data


async def get_quiz_attempt(user_id: str, quiz_id: int):
    result = supabase.table("quiz_attempts").select("*").eq("user_id", user_id).eq("quiz_id", quiz_id).execute()
    return result.data[0] if result.data else None


async def insert_quiz_attempt(user_id: str, quiz_id: int, score: int, total: int, xp: int):
    supabase.table("quiz_attempts").insert({
        "user_id": user_id,
        "quiz_id": quiz_id,
        "score": score,
        "total_questions": total,
        "xp_earned": xp,
    }).execute()


# --- Profiles ---

async def get_profile(user_id: str):
    result = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    return result.data


async def update_profile(user_id: str, data: dict):
    supabase.table("profiles").update(data).eq("id", user_id).execute()


async def add_xp(user_id: str, amount: int):
    profile = await get_profile(user_id)
    new_xp = profile["total_xp"] + amount
    supabase.table("profiles").update({"total_xp": new_xp}).eq("id", user_id).execute()


# --- Favorites ---

async def get_user_favorites(user_id: str):
    result = supabase.table("user_favorites").select(
        "*, sectors(name, slug, category)"
    ).eq("user_id", user_id).execute()
    return result.data


async def add_favorite(user_id: str, sector_id: int):
    supabase.table("user_favorites").insert({
        "user_id": user_id,
        "sector_id": sector_id,
        "gauge_score": 50,
    }).execute()


async def remove_favorite(user_id: str, sector_id: int):
    supabase.table("user_favorites").delete().eq("user_id", user_id).eq("sector_id", sector_id).execute()


async def update_gauge(user_id: str, sector_id: int, new_score: int):
    clamped = max(0, min(100, new_score))
    supabase.table("user_favorites").update({
        "gauge_score": clamped,
        "gauge_updated_at": datetime.utcnow().isoformat(),
    }).eq("user_id", user_id).eq("sector_id", sector_id).execute()


async def get_all_favorites_with_users():
    result = supabase.table("user_favorites").select("*").execute()
    return result.data


# --- Notifications ---

async def insert_notification(user_id: str, type: str, title: str, body: str, link: str | None = None):
    supabase.table("notifications").insert({
        "user_id": user_id,
        "type": type,
        "title": title,
        "body": body,
        "link": link,
    }).execute()


async def get_notifications(user_id: str, page: int = 1, limit: int = 20):
    offset = (page - 1) * limit
    result = supabase.table("notifications").select("*", count="exact").eq(
        "user_id", user_id
    ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data, result.count


async def mark_notification_read(notification_id: int):
    supabase.table("notifications").update({"read": True}).eq("id", notification_id).execute()


async def mark_all_notifications_read(user_id: str):
    supabase.table("notifications").update({"read": True}).eq("user_id", user_id).eq("read", False).execute()


# --- Leaderboard ---

async def get_global_leaderboard():
    result = supabase.table("leaderboard_global").select("*").order("rank").execute()
    return result.data


async def get_sector_leaderboard(sector_id: int):
    result = supabase.table("leaderboard_sector").select("*").eq("sector_id", sector_id).order("rank").execute()
    return result.data


async def get_user_rank(user_id: str):
    result = supabase.table("leaderboard_global").select("*").eq("user_id", user_id).execute()
    return result.data[0] if result.data else None


async def refresh_leaderboards():
    supabase.rpc("refresh_leaderboards").execute()


# --- Sectors ---

async def get_all_sectors():
    result = supabase.table("sectors").select("*").execute()
    return result.data


async def get_sector_by_slug(slug: str):
    result = supabase.table("sectors").select("*").eq("slug", slug).single().execute()
    return result.data


# --- Streak ---

async def get_streak_days(user_id: str) -> int:
    result = supabase.table("quiz_attempts").select("completed_at").eq(
        "user_id", user_id
    ).order("completed_at", desc=True).execute()

    if not result.data:
        return 0

    dates = sorted(set(
        datetime.fromisoformat(r["completed_at"]).date()
        for r in result.data
    ), reverse=True)

    if not dates:
        return 0

    today = datetime.utcnow().date()
    if dates[0] != today and dates[0] != today - __import__("datetime").timedelta(days=1):
        return 0

    streak = 1
    for i in range(1, len(dates)):
        if (dates[i - 1] - dates[i]).days == 1:
            streak += 1
        else:
            break
    return streak
```

**Step 2: Create __init__.py**

Empty file.

**Step 3: Apply refresh_leaderboards RPC function**

Apply migration `add_refresh_leaderboards_rpc`:

```sql
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_global;
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_sector;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 4: Commit**

```bash
git add backend/app/db/
git commit -m "feat: add Supabase DB client wrapper with all CRUD operations"
```

---

## Phase 2: News Ingestion Services

### Task 6: Finnhub Service

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/finnhub.py`

**Step 1: Create finnhub.py**

```python
import finnhub
import httpx
from datetime import datetime, timedelta

from app.config import settings

client = finnhub.Client(api_key=settings.finnhub_api_key)

TOP_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B",
    "JPM", "V", "JNJ", "WMT", "PG", "MA", "UNH", "HD", "DIS", "BAC",
    "XOM", "NFLX",
]

NEWS_CATEGORIES = ["general", "forex", "crypto", "merger"]


async def fetch_general_news() -> list[dict]:
    """Fetch general market news from all categories."""
    articles = []
    for category in NEWS_CATEGORIES:
        try:
            news = client.general_news(category, min_id=0)
            for item in news:
                articles.append({
                    "finnhub_id": str(item.get("id")),
                    "headline": item.get("headline", ""),
                    "snippet": item.get("summary", ""),
                    "source_name": item.get("source", ""),
                    "original_url": item.get("url", ""),
                    "image_url": item.get("image", ""),
                    "published_at": datetime.fromtimestamp(item.get("datetime", 0)).isoformat(),
                    "category": category,
                })
        except Exception as e:
            print(f"Finnhub general_news error ({category}): {e}")
    return articles


async def fetch_company_news(ticker: str) -> list[dict]:
    """Fetch news for a specific company ticker."""
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=7)
    try:
        news = client.company_news(ticker, _from=str(week_ago), to=str(today))
        return [
            {
                "finnhub_id": str(item.get("id")),
                "headline": item.get("headline", ""),
                "snippet": item.get("summary", ""),
                "source_name": item.get("source", ""),
                "original_url": item.get("url", ""),
                "image_url": item.get("image", ""),
                "published_at": datetime.fromtimestamp(item.get("datetime", 0)).isoformat(),
                "tickers": [ticker],
            }
            for item in news[:5]  # Limit to 5 most recent per ticker
        ]
    except Exception as e:
        print(f"Finnhub company_news error ({ticker}): {e}")
        return []


async def fetch_quote(ticker: str) -> dict | None:
    """Fetch current price quote for a ticker."""
    try:
        quote = client.quote(ticker)
        return {
            "ticker": ticker,
            "price": quote.get("c"),  # current price
            "price_change_pct": quote.get("dp"),  # percent change
        }
    except Exception as e:
        print(f"Finnhub quote error ({ticker}): {e}")
        return None


async def fetch_all_news() -> list[dict]:
    """Fetch news from all sources: general + top tickers."""
    articles = await fetch_general_news()

    for ticker in TOP_TICKERS:
        company_articles = await fetch_company_news(ticker)
        articles.extend(company_articles)

    return articles


async def fetch_quotes_for_tickers(tickers: list[str]) -> list[dict]:
    """Fetch quotes for a list of tickers."""
    quotes = []
    for ticker in tickers:
        quote = await fetch_quote(ticker)
        if quote:
            quotes.append(quote)
    return quotes
```

**Step 2: Create __init__.py**

Empty file.

**Step 3: Commit**

```bash
git add backend/app/services/
git commit -m "feat: add Finnhub service for news and quote fetching"
```

---

### Task 7: GNews Service

**Files:**
- Create: `backend/app/services/gnews.py`

**Step 1: Create gnews.py**

```python
import httpx
from datetime import datetime

from app.config import settings

GNEWS_BASE_URL = "https://gnews.io/api/v4/search"

REGION_QUERIES = {
    "asia": "asia finance OR economy",
    "europe": "europe finance OR economy",
    "india": "india finance OR economy",
    "china": "china finance OR economy",
    "japan": "japan finance OR economy",
    "americas": "americas finance OR economy",
    "war": "war sanctions economy impact",
}


async def fetch_region_news(region_slug: str) -> list[dict]:
    """Fetch news for a specific region/topic."""
    query = REGION_QUERIES.get(region_slug)
    if not query:
        return []

    params = {
        "q": query,
        "lang": "en",
        "max": 10,
        "apikey": settings.gnews_api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(GNEWS_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()

        articles = []
        for item in data.get("articles", []):
            articles.append({
                "gnews_url": item.get("url", ""),
                "headline": item.get("title", ""),
                "snippet": item.get("description", ""),
                "source_name": item.get("source", {}).get("name", ""),
                "original_url": item.get("url", ""),
                "image_url": item.get("image"),
                "published_at": item.get("publishedAt"),
                "region": region_slug,
            })
        return articles
    except Exception as e:
        print(f"GNews error ({region_slug}): {e}")
        return []


async def fetch_all_regions() -> list[dict]:
    """Fetch news from all configured regions."""
    all_articles = []
    for slug in REGION_QUERIES:
        articles = await fetch_region_news(slug)
        all_articles.extend(articles)
    return all_articles
```

**Step 2: Commit**

```bash
git add backend/app/services/gnews.py
git commit -m "feat: add GNews service for international news fetching"
```

---

### Task 8: Trafilatura Scraper Service

**Files:**
- Create: `backend/app/services/scraper.py`

**Step 1: Create scraper.py**

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

import httpx
import trafilatura

executor = ThreadPoolExecutor(max_workers=4)


def _extract_article(html: str) -> dict | None:
    """Synchronous trafilatura extraction (runs in thread pool)."""
    result = trafilatura.extract(
        html,
        no_fallback=True,
        favor_precision=True,
        include_comments=False,
        include_tables=False,
        output_format="json",
        with_metadata=True,
    )
    if result:
        import json
        return json.loads(result)
    return None


async def scrape_article(url: str) -> dict | None:
    """Scrape a single article URL and extract content."""
    try:
        async with httpx.AsyncClient(
            timeout=30,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; FinaMeter/1.0)"},
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            html = response.text

        loop = asyncio.get_event_loop()
        extracted = await loop.run_in_executor(executor, _extract_article, html)
        return extracted
    except Exception as e:
        print(f"Scraper error ({url}): {e}")
        return None


async def scrape_batch(urls: list[str]) -> list[dict | None]:
    """Scrape multiple URLs in parallel."""
    tasks = [scrape_article(url) for url in urls]
    return await asyncio.gather(*tasks, return_exceptions=True)
```

**Step 2: Commit**

```bash
git add backend/app/services/scraper.py
git commit -m "feat: add Trafilatura scraper service with async batch processing"
```

---

### Task 9: LLM Service (OpenRouter / MiniMax M2.5)

**Files:**
- Create: `backend/app/services/llm.py`

**Step 1: Create llm.py**

```python
import httpx

from app.config import settings
from app.models.llm_output import LLMArticleOutput

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """You are a financial news analyst and educator. Given a news article, you must produce:

1. **summary**: A concise 3-4 paragraph summary of the article's key points.
2. **tutorial**: A short financial literacy lesson (2-3 paragraphs) explaining the financial concepts mentioned in the article in simple terms. Teach the reader something they can apply.
3. **questions**: 3-5 multiple choice questions testing comprehension of the article and the financial concepts. Each question must have exactly 4 options, a correct_index (0-3), and an explanation of why the answer is correct.
4. **sectors**: A list of sector slugs this article belongs to. Choose from: asia, americas, europe, india, china, japan, war, crypto, stocks, options, bonds, currency, etfs, indices, sector.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "...",
  "tutorial": "...",
  "questions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "..."
    }
  ],
  "sectors": ["stocks", "americas"]
}"""


async def generate_article_content(headline: str, body: str) -> LLMArticleOutput | None:
    """Generate summary, tutorial, and quiz from article content."""
    user_prompt = f"""Article headline: {headline}

Article body:
{body[:8000]}"""  # Truncate to stay within context limits

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "minimax/minimax-m2.5",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()
            data = response.json()

        raw_content = data["choices"][0]["message"]["content"]
        return LLMArticleOutput.from_raw_response(raw_content)
    except Exception as e:
        print(f"LLM error: {e}")
        return None
```

**Step 2: Commit**

```bash
git add backend/app/services/llm.py
git commit -m "feat: add LLM service for article content generation via OpenRouter"
```

---

### Task 10: Ingestion Pipeline Orchestrator

**Files:**
- Create: `backend/app/services/pipeline.py`

**Step 1: Create pipeline.py**

```python
from app.db import supabase as db
from app.services import finnhub, gnews, scraper, llm


async def ingest_finnhub():
    """Full Finnhub ingestion cycle: fetch news, deduplicate, save."""
    articles = await finnhub.fetch_all_news()
    saved_count = 0

    for article in articles:
        if await db.article_exists(finnhub_id=article.get("finnhub_id"), original_url=article.get("original_url")):
            continue

        article_id = await db.insert_article({
            "finnhub_id": article.get("finnhub_id"),
            "source_name": article.get("source_name", ""),
            "headline": article.get("headline", ""),
            "snippet": article.get("snippet"),
            "original_url": article.get("original_url", ""),
            "image_url": article.get("image_url"),
            "published_at": article.get("published_at"),
            "processing_status": "pending",
        })

        # Fetch and attach ticker quotes if available
        tickers = article.get("tickers", [])
        if tickers:
            quotes = await finnhub.fetch_quotes_for_tickers(tickers)
            if quotes:
                await db.insert_article_tickers(article_id, quotes)

        saved_count += 1

    print(f"Finnhub ingestion: {saved_count} new articles saved")
    return saved_count


async def ingest_gnews():
    """Full GNews ingestion cycle: fetch all regions, deduplicate, save."""
    articles = await gnews.fetch_all_regions()
    saved_count = 0

    for article in articles:
        if await db.article_exists(gnews_url=article.get("gnews_url"), original_url=article.get("original_url")):
            continue

        region = article.pop("region", None)
        article_id = await db.insert_article({
            "gnews_url": article.get("gnews_url"),
            "source_name": article.get("source_name", ""),
            "headline": article.get("headline", ""),
            "snippet": article.get("snippet"),
            "original_url": article.get("original_url", ""),
            "image_url": article.get("image_url"),
            "published_at": article.get("published_at"),
            "processing_status": "pending",
        })

        # Map region to sector
        if region:
            sector = await db.get_sector_by_slug(region)
            if sector:
                await db.insert_article_sectors(article_id, [sector["id"]])

        saved_count += 1

    print(f"GNews ingestion: {saved_count} new articles saved")
    return saved_count


async def process_pending_articles(batch_size: int = 5):
    """Scrape and generate AI content for pending articles."""
    articles, _ = await db.get_articles(status="pending", page=1, limit=batch_size)

    for article in articles:
        article_id = article["id"]

        # Step 1: Scrape
        await db.update_article(article_id, {"processing_status": "scraping"})
        scraped = await scraper.scrape_article(article["original_url"])

        if not scraped:
            await db.update_article(article_id, {"processing_status": "failed"})
            continue

        raw_text = scraped.get("text", "")
        author = scraped.get("author")
        await db.update_article(article_id, {
            "raw_content": raw_text,
            "author": author,
            "processing_status": "generating",
        })

        # Step 2: LLM generate
        result = await llm.generate_article_content(article["headline"], raw_text)

        if not result:
            await db.update_article(article_id, {"processing_status": "failed"})
            continue

        # Save AI content
        await db.update_article(article_id, {
            "ai_summary": result.summary,
            "ai_tutorial": result.tutorial,
            "processing_status": "done",
        })

        # Save sectors
        if result.sectors:
            sectors = await db.get_all_sectors()
            sector_map = {s["slug"]: s["id"] for s in sectors}
            sector_ids = [sector_map[s] for s in result.sectors if s in sector_map]
            if sector_ids:
                # Check for existing sector mappings first
                existing = article.get("article_sectors", [])
                existing_ids = {s.get("sector_id") for s in existing} if existing else set()
                new_ids = [sid for sid in sector_ids if sid not in existing_ids]
                if new_ids:
                    await db.insert_article_sectors(article_id, new_ids)

        # Save quiz
        await db.insert_quiz(article_id, [q.model_dump() for q in result.questions])

        # Notify users who favorite these sectors
        await _notify_sector_users(article_id, article["headline"])

    print(f"Processed {len(articles)} articles")


async def _notify_sector_users(article_id: int, headline: str):
    """Send notifications to users who favorite the article's sectors."""
    article = await db.get_article_by_id(article_id)
    if not article:
        return

    sector_ids = [s["sector_id"] for s in article.get("article_sectors", [])]
    if not sector_ids:
        return

    all_favorites = await db.get_all_favorites_with_users()
    notified_users = set()

    for fav in all_favorites:
        if fav["sector_id"] in sector_ids and fav["user_id"] not in notified_users:
            await db.insert_notification(
                user_id=fav["user_id"],
                type="new_article",
                title="New article in your sector",
                body=headline[:200],
                link=f"/article/{article_id}",
            )
            notified_users.add(fav["user_id"])
```

**Step 2: Commit**

```bash
git add backend/app/services/pipeline.py
git commit -m "feat: add ingestion pipeline orchestrator (fetch, scrape, LLM, notify)"
```

---

### Task 11: Gauge & XP Services

**Files:**
- Create: `backend/app/services/gauge.py`
- Create: `backend/app/services/xp.py`

**Step 1: Create gauge.py**

```python
from datetime import datetime, timedelta

from app.db import supabase as db


async def process_gauge_decay():
    """Run gauge decay for all users with favorites."""
    all_favorites = await db.get_all_favorites_with_users()

    for fav in all_favorites:
        user_id = fav["user_id"]
        sector_id = fav["sector_id"]
        current_score = fav["gauge_score"]

        # Count unread articles older than 30 min in this sector
        pending = await _count_pending_articles(user_id, sector_id)
        decay = min(pending * 5, 15)  # Cap at -15

        # Weekend modifier
        if datetime.utcnow().weekday() >= 5:
            decay = decay // 2

        if decay > 0:
            new_score = max(current_score - decay, 20)  # Floor at 20
            await db.update_gauge(user_id, sector_id, new_score)


async def _count_pending_articles(user_id: str, sector_id: int) -> int:
    """Count articles in sector that user hasn't quizzed on, older than 30 min."""
    from app.dependencies import supabase

    # Get articles in this sector from last 24 hours, older than 30 min
    cutoff = (datetime.utcnow() - timedelta(minutes=30)).isoformat()
    day_ago = (datetime.utcnow() - timedelta(hours=24)).isoformat()

    articles = supabase.table("article_sectors").select(
        "article_id, articles(id, created_at)"
    ).eq("sector_id", sector_id).execute()

    if not articles.data:
        return 0

    article_ids = [
        a["article_id"] for a in articles.data
        if a.get("articles", {}).get("created_at", "") < cutoff
        and a.get("articles", {}).get("created_at", "") > day_ago
    ]

    if not article_ids:
        return 0

    # Check which ones user has already quizzed on
    quizzes = supabase.table("quizzes").select("id, article_id").in_("article_id", article_ids).execute()
    quiz_ids = [q["id"] for q in quizzes.data]

    if not quiz_ids:
        return len(article_ids)

    attempts = supabase.table("quiz_attempts").select("quiz_id").eq(
        "user_id", user_id
    ).in_("quiz_id", quiz_ids).execute()

    completed_quiz_ids = {a["quiz_id"] for a in attempts.data}
    pending_count = sum(1 for q in quizzes.data if q["id"] not in completed_quiz_ids)
    return min(pending_count, 3)  # Cap at 3 for decay calculation


async def calculate_gauge_gain(score: int, total: int) -> int:
    """Calculate gauge points earned from a quiz."""
    if score == total:
        return 10
    elif score >= total - 1:
        return 8
    elif score >= total - 2:
        return 6
    else:
        return 3
```

**Step 2: Create xp.py**

```python
from datetime import datetime, timedelta

from app.db import supabase as db


async def calculate_quiz_xp(user_id: str, score: int, total: int) -> int:
    """Calculate total XP earned from a quiz completion."""
    # Base XP (mirrors gauge gain)
    if score == total:
        xp = 10
    elif score >= total - 1:
        xp = 8
    elif score >= total - 2:
        xp = 6
    else:
        xp = 3

    # Daily bonus
    if await _is_first_quiz_today(user_id):
        xp += 5

    # Streak bonuses
    streak = await db.get_streak_days(user_id)
    if streak == 7:
        xp += 25
    elif streak == 30:
        xp += 100

    return xp


async def award_passive_xp():
    """Award +2 XP to users with any gauge at 100. Runs every 10 min."""
    from app.dependencies import supabase

    result = supabase.table("user_favorites").select(
        "user_id"
    ).eq("gauge_score", 100).execute()

    awarded_users = set()
    for fav in result.data:
        user_id = fav["user_id"]
        if user_id not in awarded_users:
            await db.add_xp(user_id, 2)
            awarded_users.add(user_id)

    if awarded_users:
        print(f"Passive XP: awarded to {len(awarded_users)} users")


async def _is_first_quiz_today(user_id: str) -> bool:
    """Check if this is the user's first quiz completion today."""
    from app.dependencies import supabase

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0).isoformat()
    result = supabase.table("quiz_attempts").select("id").eq(
        "user_id", user_id
    ).gte("completed_at", today_start).execute()

    return len(result.data) == 0
```

**Step 3: Commit**

```bash
git add backend/app/services/gauge.py backend/app/services/xp.py
git commit -m "feat: add gauge decay and XP calculation services"
```

---

### Task 12: Scheduler (APScheduler)

**Files:**
- Create: `backend/app/scheduler/__init__.py`
- Create: `backend/app/scheduler/jobs.py`
- Modify: `backend/app/main.py`

**Step 1: Create jobs.py**

```python
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.services.pipeline import ingest_finnhub, ingest_gnews, process_pending_articles
from app.services.gauge import process_gauge_decay
from app.services.xp import award_passive_xp
from app.db.supabase import refresh_leaderboards


def get_adaptive_interval_minutes() -> int:
    """Return polling interval based on market hours (ET)."""
    now = datetime.utcnow()
    # Convert UTC to ET (approximate, UTC-5)
    et_hour = (now.hour - 5) % 24

    if 9 <= et_hour < 16:  # Market hours 9:30-4 (using 9-16 for simplicity)
        return 5
    elif 7 <= et_hour < 9 or 16 <= et_hour < 20:  # Pre/post market
        return 10
    else:  # Off hours
        return 30


scheduler = AsyncIOScheduler()


async def finnhub_adaptive_job():
    """Adaptively poll Finnhub based on market hours."""
    await ingest_finnhub()
    await process_pending_articles(batch_size=5)

    # Reschedule with new interval
    interval = get_adaptive_interval_minutes()
    scheduler.reschedule_job("finnhub_poll", trigger=IntervalTrigger(minutes=interval))
    print(f"Next Finnhub poll in {interval} min")


def setup_scheduler():
    """Configure and return the scheduler with all jobs."""
    # Finnhub adaptive polling (starts at 15 min, self-adjusts)
    scheduler.add_job(
        finnhub_adaptive_job,
        IntervalTrigger(minutes=15),
        id="finnhub_poll",
        name="Finnhub adaptive news poll",
        replace_existing=True,
    )

    # GNews every 2 hours
    scheduler.add_job(
        ingest_gnews,
        IntervalTrigger(hours=2),
        id="gnews_poll",
        name="GNews international news poll",
        replace_existing=True,
    )

    # Process pending articles every 5 min
    scheduler.add_job(
        lambda: process_pending_articles(batch_size=5),
        IntervalTrigger(minutes=5),
        id="process_pending",
        name="Process pending articles (scrape + LLM)",
        replace_existing=True,
    )

    # Gauge decay every 10 min
    scheduler.add_job(
        process_gauge_decay,
        IntervalTrigger(minutes=10),
        id="gauge_decay",
        name="Gauge decay calculation",
        replace_existing=True,
    )

    # Passive XP every 10 min
    scheduler.add_job(
        award_passive_xp,
        IntervalTrigger(minutes=10),
        id="passive_xp",
        name="Passive XP for gauge=100 users",
        replace_existing=True,
    )

    # Leaderboard refresh every 5 min
    scheduler.add_job(
        refresh_leaderboards,
        IntervalTrigger(minutes=5),
        id="refresh_lb",
        name="Refresh leaderboard materialized views",
        replace_existing=True,
    )

    # Notification cleanup daily at 3 AM UTC
    scheduler.add_job(
        _cleanup_notifications,
        CronTrigger(hour=3, minute=0),
        id="cleanup_notifications",
        name="Delete expired notifications",
        replace_existing=True,
    )

    return scheduler


async def _cleanup_notifications():
    """Delete expired notifications."""
    from app.dependencies import supabase
    supabase.table("notifications").delete().lt(
        "expires_at", datetime.utcnow().isoformat()
    ).execute()
    print("Cleaned up expired notifications")
```

**Step 2: Create __init__.py**

Empty file.

**Step 3: Update main.py to start scheduler**

Replace the lifespan in `backend/app/main.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.scheduler.jobs import setup_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    sched = setup_scheduler()
    sched.start()
    print("Scheduler started")
    yield
    sched.shutdown()
    print("Scheduler stopped")


app = FastAPI(title="FinaMeter API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
```

**Step 4: Commit**

```bash
git add backend/app/scheduler/ backend/app/main.py
git commit -m "feat: add APScheduler with adaptive Finnhub polling and all cron jobs"
```

---

## Phase 3: API Routers

### Task 13: Articles Router

**Files:**
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/articles.py`
- Modify: `backend/app/main.py` (register router)

**Step 1: Create articles.py**

```python
from fastapi import APIRouter, Query

from app.db import supabase as db

router = APIRouter(prefix="/api/v1/articles", tags=["articles"])


@router.get("")
async def list_articles(
    sector: str | None = Query(None),
    category: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    articles, total = await db.get_articles(
        sector=sector, category=category, page=page, limit=limit
    )
    return {
        "success": True,
        "data": articles,
        "meta": {"page": page, "limit": limit, "total": total},
    }


@router.get("/headlines")
async def get_headlines():
    # Hero: most recent article
    all_articles, _ = await db.get_articles(page=1, limit=20)

    hero = all_articles[0] if all_articles else None
    trending = all_articles[1:5] if len(all_articles) > 1 else []

    # World and markets previews
    world_articles, _ = await db.get_articles(category="world", page=1, limit=4)
    market_articles, _ = await db.get_articles(category="markets", page=1, limit=4)

    return {
        "success": True,
        "data": {
            "hero": hero,
            "trending": trending,
            "world": world_articles,
            "markets": market_articles,
        },
    }


@router.get("/{article_id}")
async def get_article(article_id: int):
    article = await db.get_article_by_id(article_id)
    if not article:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Article not found"}}
    return {"success": True, "data": article}


@router.get("/{article_id}/tickers")
async def get_article_tickers(article_id: int):
    article = await db.get_article_by_id(article_id)
    if not article:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Article not found"}}
    return {"success": True, "data": article.get("article_tickers", [])}
```

**Step 2: Create __init__.py**

Empty file.

**Step 3: Register router in main.py**

Add to `main.py` after the app is created:

```python
from app.routers import articles
app.include_router(articles.router)
```

**Step 4: Commit**

```bash
git add backend/app/routers/
git commit -m "feat: add articles API router with list, headlines, and detail endpoints"
```

---

### Task 14: Quizzes Router

**Files:**
- Create: `backend/app/routers/quizzes.py`
- Modify: `backend/app/main.py` (register router)

**Step 1: Create quizzes.py**

```python
from fastapi import APIRouter, Depends

from app.db import supabase as db
from app.dependencies import get_current_user
from app.models.quiz import QuizSubmit
from app.services.gauge import calculate_gauge_gain
from app.services.xp import calculate_quiz_xp

router = APIRouter(prefix="/api/v1/articles", tags=["quizzes"])


@router.get("/{article_id}/quiz")
async def get_quiz(article_id: int):
    quiz = await db.get_quiz_by_article(article_id)
    if not quiz:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Quiz not found"}}

    # Strip correct answers for display
    questions = []
    for q in quiz.get("quiz_questions", []):
        questions.append({
            "id": q["id"],
            "question_text": q["question_text"],
            "options": q["options"],
            "order_num": q["order_num"],
        })

    return {
        "success": True,
        "data": {
            "id": quiz["id"],
            "article_id": quiz["article_id"],
            "questions": sorted(questions, key=lambda x: x["order_num"]),
        },
    }


@router.post("/{article_id}/quiz")
async def submit_quiz(
    article_id: int,
    submission: QuizSubmit,
    user_id: str = Depends(get_current_user),
):
    quiz = await db.get_quiz_by_article(article_id)
    if not quiz:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Quiz not found"}}

    # Check if already attempted
    existing = await db.get_quiz_attempt(user_id, quiz["id"])
    if existing:
        return {"success": False, "error": {"code": "QUIZ_ALREADY_COMPLETED", "message": "You have already completed this quiz"}}

    # Grade
    questions = sorted(quiz["quiz_questions"], key=lambda x: x["order_num"])
    if len(submission.answers) != len(questions):
        return {"success": False, "error": {"code": "INVALID_ANSWERS", "message": f"Expected {len(questions)} answers"}}

    score = 0
    feedback = []
    for i, q in enumerate(questions):
        is_correct = submission.answers[i] == q["correct_index"]
        if is_correct:
            score += 1
        feedback.append({
            "question_text": q["question_text"],
            "your_answer": submission.answers[i],
            "correct_answer": q["correct_index"],
            "is_correct": is_correct,
            "explanation": q["explanation"],
        })

    total = len(questions)

    # Calculate rewards
    gauge_gain = await calculate_gauge_gain(score, total)
    xp_earned = await calculate_quiz_xp(user_id, score, total)

    # Save attempt
    await db.insert_quiz_attempt(user_id, quiz["id"], score, total, xp_earned)

    # Update XP
    await db.add_xp(user_id, xp_earned)

    # Update gauge for relevant sectors
    article = await db.get_article_by_id(article_id)
    sector_ids = [s["sector_id"] for s in article.get("article_sectors", [])]
    favorites = await db.get_user_favorites(user_id)
    fav_sector_ids = {f["sector_id"]: f for f in favorites}

    new_gauge = 0
    for sid in sector_ids:
        if sid in fav_sector_ids:
            current = fav_sector_ids[sid]["gauge_score"]
            new_gauge = min(current + gauge_gain, 100)
            await db.update_gauge(user_id, sid, new_gauge)

    return {
        "success": True,
        "data": {
            "score": score,
            "total_questions": total,
            "xp_earned": xp_earned,
            "gauge_change": gauge_gain,
            "new_gauge_score": new_gauge,
            "explanations": feedback,
        },
    }
```

**Step 2: Register router in main.py**

```python
from app.routers import quizzes
app.include_router(quizzes.router)
```

**Step 3: Commit**

```bash
git add backend/app/routers/quizzes.py backend/app/main.py
git commit -m "feat: add quiz router with get and submit endpoints"
```

---

### Task 15: Profile, Favorites, Leaderboard, Notifications, Sectors Routers

**Files:**
- Create: `backend/app/routers/profile.py`
- Create: `backend/app/routers/favorites.py`
- Create: `backend/app/routers/leaderboard.py`
- Create: `backend/app/routers/notifications.py`
- Create: `backend/app/routers/sectors.py`
- Modify: `backend/app/main.py` (register all routers)

**Step 1: Create profile.py**

```python
from fastapi import APIRouter, Depends

from app.db import supabase as db
from app.dependencies import get_current_user
from app.models.user import ProfileUpdate

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


@router.get("")
async def get_dashboard(user_id: str = Depends(get_current_user)):
    profile = await db.get_profile(user_id)
    streak = await db.get_streak_days(user_id)
    rank = await db.get_user_rank(user_id)
    favorites = await db.get_user_favorites(user_id)

    return {
        "success": True,
        "data": {
            "profile": profile,
            "streak_days": streak,
            "global_rank": rank["rank"] if rank else None,
            "favorites": favorites,
        },
    }


@router.put("")
async def update_profile(
    data: ProfileUpdate,
    user_id: str = Depends(get_current_user),
):
    update_data = data.model_dump(exclude_none=True)
    if update_data:
        await db.update_profile(user_id, update_data)
    profile = await db.get_profile(user_id)
    return {"success": True, "data": profile}
```

**Step 2: Create favorites.py**

```python
from fastapi import APIRouter, Depends

from app.db import supabase as db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/favorites", tags=["favorites"])


@router.get("")
async def get_favorites(user_id: str = Depends(get_current_user)):
    favorites = await db.get_user_favorites(user_id)
    return {"success": True, "data": favorites}


@router.post("")
async def add_favorite(
    body: dict,
    user_id: str = Depends(get_current_user),
):
    sector_id = body.get("sector_id")
    if not sector_id:
        return {"success": False, "error": {"code": "MISSING_FIELD", "message": "sector_id required"}}
    await db.add_favorite(user_id, sector_id)
    return {"success": True, "data": {"sector_id": sector_id, "gauge_score": 50}}


@router.delete("/{sector_id}")
async def remove_favorite(
    sector_id: int,
    user_id: str = Depends(get_current_user),
):
    await db.remove_favorite(user_id, sector_id)
    return {"success": True}


@router.get("/pending")
async def get_pending_quizzes(user_id: str = Depends(get_current_user)):
    favorites = await db.get_user_favorites(user_id)
    # For each favorite sector, count pending quizzes
    # This is a simplified version — full implementation would query unquizzed articles per sector
    return {"success": True, "data": favorites}
```

**Step 3: Create leaderboard.py**

```python
from fastapi import APIRouter, Depends

from app.db import supabase as db
from app.dependencies import get_current_user, get_optional_user

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


@router.get("")
async def get_global_leaderboard():
    data = await db.get_global_leaderboard()
    return {"success": True, "data": data}


@router.get("/me")
async def get_my_rank(user_id: str = Depends(get_current_user)):
    rank = await db.get_user_rank(user_id)
    return {"success": True, "data": rank}


@router.get("/{sector_slug}")
async def get_sector_leaderboard(sector_slug: str):
    sector = await db.get_sector_by_slug(sector_slug)
    if not sector:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Sector not found"}}
    data = await db.get_sector_leaderboard(sector["id"])
    return {"success": True, "data": data}
```

**Step 4: Create notifications.py**

```python
from fastapi import APIRouter, Depends, Query

from app.db import supabase as db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user),
):
    data, total = await db.get_notifications(user_id, page, limit)
    return {
        "success": True,
        "data": data,
        "meta": {"page": page, "limit": limit, "total": total},
    }


@router.patch("/{notification_id}")
async def mark_read(
    notification_id: int,
    user_id: str = Depends(get_current_user),
):
    await db.mark_notification_read(notification_id)
    return {"success": True}


@router.post("/read-all")
async def mark_all_read(user_id: str = Depends(get_current_user)):
    await db.mark_all_notifications_read(user_id)
    return {"success": True}
```

**Step 5: Create sectors.py**

```python
from fastapi import APIRouter

from app.db import supabase as db

router = APIRouter(prefix="/api/v1/sectors", tags=["sectors"])


@router.get("")
async def get_sectors():
    data = await db.get_all_sectors()
    return {"success": True, "data": data}
```

**Step 6: Register all routers in main.py**

Update `main.py` to include all routers:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.scheduler.jobs import setup_scheduler
from app.routers import articles, quizzes, profile, favorites, leaderboard, notifications, sectors


@asynccontextmanager
async def lifespan(app: FastAPI):
    sched = setup_scheduler()
    sched.start()
    print("Scheduler started")
    yield
    sched.shutdown()
    print("Scheduler stopped")


app = FastAPI(title="FinaMeter API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(articles.router)
app.include_router(quizzes.router)
app.include_router(profile.router)
app.include_router(favorites.router)
app.include_router(leaderboard.router)
app.include_router(notifications.router)
app.include_router(sectors.router)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
```

**Step 7: Commit**

```bash
git add backend/app/routers/ backend/app/main.py
git commit -m "feat: add profile, favorites, leaderboard, notifications, sectors routers"
```

---

## Phase 4: Frontend

### Task 16: Next.js Project Scaffold

**Files:**
- Create: `frontend/` (via create-next-app)

**Step 1: Scaffold Next.js project**

Run:
```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

**Step 3: Configure next.config.js for FastAPI rewrites**

Replace `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

module.exports = nextConfig;
```

**Step 4: Create .env.local.example**

```
NEXT_PUBLIC_SUPABASE_URL=https://zgusqjuuqmhzpjrkgxhg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold Next.js frontend with Tailwind, Supabase, and API rewrites"
```

---

### Task 17: Supabase Client & Auth Setup

**Files:**
- Create: `frontend/src/lib/supabase/client.ts`
- Create: `frontend/src/lib/supabase/server.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/types/index.ts`

**Step 1: Create client.ts**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create server.ts**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}
```

**Step 3: Create api.ts**

```typescript
export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string }; meta?: Record<string, unknown> }> {
  const { token, ...fetchOptions } = options || {};

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`/api/v1${path}`, {
    ...fetchOptions,
    headers: { ...headers, ...(fetchOptions.headers as Record<string, string>) },
  });

  return res.json();
}
```

**Step 4: Create types/index.ts**

```typescript
export interface Article {
  id: number;
  source_name: string;
  headline: string;
  snippet: string | null;
  original_url: string;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
  ai_summary: string | null;
  ai_tutorial: string | null;
  processing_status: string;
  created_at: string;
  article_sectors?: { sector_id: number; sectors: Sector }[];
  article_tickers?: Ticker[];
}

export interface Sector {
  id: number;
  name: string;
  category: "world" | "markets";
  slug: string;
}

export interface Ticker {
  ticker: string;
  price: number | null;
  price_change_pct: number | null;
}

export interface Quiz {
  id: number;
  article_id: number;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: number;
  question_text: string;
  options: string[];
  order_num: number;
}

export interface QuizResult {
  score: number;
  total_questions: number;
  xp_earned: number;
  gauge_change: number;
  new_gauge_score: number;
  explanations: QuestionFeedback[];
}

export interface QuestionFeedback {
  question_text: string;
  your_answer: number;
  correct_answer: number;
  is_correct: boolean;
  explanation: string;
}

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number;
  created_at: string;
}

export interface Favorite {
  sector_id: number;
  gauge_score: number;
  gauge_updated_at: string;
  sectors: Sector;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  xp: number;
  rank: number;
}

export interface Notification {
  id: number;
  type: "new_article" | "gauge_decay" | "achievement";
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}
```

**Step 5: Create useAuth.ts**

```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUpWithEmail = async (email: string, password: string) => {
    return supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
```

**Step 6: Commit**

```bash
git add frontend/src/lib/ frontend/src/hooks/ frontend/src/types/
git commit -m "feat: add Supabase client, API wrapper, auth hook, and TypeScript types"
```

---

### Task 18: Auth Callback & Login Page

**Files:**
- Create: `frontend/src/app/auth/callback/route.ts`
- Create: `frontend/src/app/login/page.tsx`

**Step 1: Create auth callback route**

```typescript
// frontend/src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile/onboarding";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

**Step 2: Create login page**

Use the `frontend-design` skill for the login page implementation. The page should include:
- Email/password form
- Google OAuth button
- Dark theme, teal accents
- FinaMeter branding

**Step 3: Commit**

```bash
git add frontend/src/app/auth/ frontend/src/app/login/
git commit -m "feat: add auth callback and login page"
```

---

### Task 19: Root Layout & Navbar

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/globals.css` (update)
- Create: `frontend/src/components/layout/Navbar.tsx`
- Create: `frontend/src/components/layout/NavDropdown.tsx`

**Step 1: Build root layout and navbar**

Use the `frontend-design` skill. Requirements:
- Dark theme (`bg-gray-950` / `bg-gray-900`)
- Top navbar: "FinaMeter" logo (left), World dropdown, Markets dropdown, notification bell, login/avatar (right)
- World dropdown items: Asia, Americas, Europe, India, China, Japan, War
- Markets dropdown items: Crypto, Stocks, Options, Bonds, Currency, ETFs, World Indices, Sector
- Links: World items → `/world/[slug]`, Markets items → `/markets/[slug]`
- Mobile responsive hamburger menu
- Teal/cyan accent color (`#14b8a6` / `teal-400`)

**Step 2: Commit**

```bash
git add frontend/src/app/layout.tsx frontend/src/app/globals.css frontend/src/components/layout/
git commit -m "feat: add dark theme root layout with navbar and sector dropdowns"
```

---

### Task 20: Home Page

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Create: `frontend/src/components/home/HeroCard.tsx`
- Create: `frontend/src/components/home/TrendingGrid.tsx`
- Create: `frontend/src/components/home/SectorPreview.tsx`

**Step 1: Build home page**

Use the `frontend-design` skill. Requirements:
- Fetches `/api/v1/articles/headlines`
- Hero card: large featured article with image, headline, source, time ago
- Trending grid: 4 article cards in a row
- World preview section: 4 bullet-style headlines, "See all →" link
- Markets preview section: same format
- Live ticker bar at bottom (placeholder for now, WebSocket in Task 24)
- Dark theme, responsive

**Step 2: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/components/home/
git commit -m "feat: add home page with hero, trending, and sector previews"
```

---

### Task 21: Sector Feed Pages

**Files:**
- Create: `frontend/src/app/world/page.tsx`
- Create: `frontend/src/app/world/[slug]/page.tsx`
- Create: `frontend/src/app/markets/page.tsx`
- Create: `frontend/src/app/markets/[slug]/page.tsx`
- Create: `frontend/src/components/feed/ArticleCard.tsx`
- Create: `frontend/src/components/feed/ArticleList.tsx`

**Step 1: Build sector feed pages**

Use the `frontend-design` skill. Requirements:
- Landing pages (`/world`, `/markets`): grid of subsector cards linking to each subsector
- Subsector pages (`/world/[slug]`, `/markets/[slug]`): paginated article feed
- ArticleCard: image (left), headline, source, time ago, snippet (right)
- "Load more" button at bottom (cursor-based or page-based pagination)
- Back button, sector name as header
- Dark theme

**Step 2: Commit**

```bash
git add frontend/src/app/world/ frontend/src/app/markets/ frontend/src/components/feed/
git commit -m "feat: add world and markets sector feed pages with article cards"
```

---

### Task 22: Article Detail Page

**Files:**
- Create: `frontend/src/app/article/[id]/page.tsx`
- Create: `frontend/src/components/article/ArticleHeader.tsx`
- Create: `frontend/src/components/article/TickerBadges.tsx`
- Create: `frontend/src/components/article/TabSwitcher.tsx`
- Create: `frontend/src/components/article/SummaryTab.tsx`
- Create: `frontend/src/components/article/TutorialTab.tsx`

**Step 1: Build article detail page**

Use the `frontend-design` skill. Requirements:
- Fetches `/api/v1/articles/:id`
- Header: headline, source, date, author
- Ticker badges row: e.g., "BTC $67,420 ▲2.1%" with green/red coloring
- Tab switcher: Summary | Financial Learning | Quiz
- Summary tab: renders `ai_summary` as formatted text
- Tutorial tab: renders `ai_tutorial` as formatted text
- Quiz tab: "Take Quiz →" button linking to `/article/[id]/quiz`
- "Read original article →" link at bottom
- Dark theme

**Step 2: Commit**

```bash
git add frontend/src/app/article/ frontend/src/components/article/
git commit -m "feat: add article detail page with tabs for summary, tutorial, quiz"
```

---

### Task 23: Quiz Page

**Files:**
- Create: `frontend/src/app/article/[id]/quiz/page.tsx`
- Create: `frontend/src/components/quiz/QuizCard.tsx`
- Create: `frontend/src/components/quiz/QuizOption.tsx`
- Create: `frontend/src/components/quiz/QuizResults.tsx`

**Step 1: Build quiz page**

Use the `frontend-design` skill. Requirements:
- Fetches `/api/v1/articles/:id/quiz`
- Shows one question at a time with progress bar (1/5, 2/5, etc.)
- 4 option buttons per question, highlight selected
- "Next" button to advance, "Submit" on last question
- On submit: POST to `/api/v1/articles/:id/quiz` with answers array
- Results screen: score, XP earned, gauge change, per-question feedback with explanations
- Green/red indicators for correct/incorrect
- "Back to article" button
- Requires auth — redirect to login if not signed in
- Dark theme

**Step 2: Commit**

```bash
git add frontend/src/app/article/ frontend/src/components/quiz/
git commit -m "feat: add interactive quiz page with step-by-step questions and results"
```

---

### Task 24: Profile Dashboard & Onboarding

**Files:**
- Create: `frontend/src/app/profile/page.tsx`
- Create: `frontend/src/app/profile/onboarding/page.tsx`
- Create: `frontend/src/components/profile/GaugeMeter.tsx`
- Create: `frontend/src/components/profile/SectorCard.tsx`
- Create: `frontend/src/components/profile/XPDisplay.tsx`
- Create: `frontend/src/components/profile/StreakBadge.tsx`
- Create: `frontend/src/components/profile/ActivityFeed.tsx`

**Step 1: Build onboarding page**

Use the `frontend-design` skill. Requirements:
- Grid of all 15 sectors as selectable cards
- User toggles favorites (minimum 1, maximum 8 recommended)
- "Continue" button → POST selected sectors to `/api/v1/favorites`
- Redirects to `/profile` after saving
- Dark theme

**Step 2: Build profile dashboard**

Use the `frontend-design` skill. Requirements:
- Fetches `/api/v1/profile`
- Header: avatar, name, level, total XP, streak badge, global rank
- "My Sectors" grid: cards with circular gauge meter (animated, teal fill), sector name, pending quiz count
- GaugeMeter component: SVG circular progress from 0-100, teal color, animated
- Activity feed: recent quiz completions with XP earned
- Dark theme

**Step 3: Commit**

```bash
git add frontend/src/app/profile/ frontend/src/components/profile/
git commit -m "feat: add profile dashboard with gauge meters and onboarding flow"
```

---

### Task 25: Leaderboard Page

**Files:**
- Create: `frontend/src/app/leaderboard/page.tsx`
- Create: `frontend/src/components/leaderboard/LeaderboardTable.tsx`
- Create: `frontend/src/components/leaderboard/SectorTabs.tsx`

**Step 1: Build leaderboard page**

Use the `frontend-design` skill. Requirements:
- Fetches `/api/v1/leaderboard` and `/api/v1/leaderboard/:sector`
- Tab bar: "Global" + one tab per sector
- Table: rank, avatar, username, XP
- Current user highlighted if logged in
- Top 3 users get gold/silver/bronze styling
- Dark theme

**Step 2: Commit**

```bash
git add frontend/src/app/leaderboard/ frontend/src/components/leaderboard/
git commit -m "feat: add leaderboard page with global and per-sector rankings"
```

---

### Task 26: Notification System

**Files:**
- Create: `frontend/src/components/ui/NotificationBell.tsx`
- Create: `frontend/src/components/ui/NotificationPanel.tsx`
- Create: `frontend/src/hooks/useNotifications.ts`

**Step 1: Create useNotifications hook**

```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./useAuth";
import type { Notification } from "@/types";

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;

    // Initial fetch
    fetch(`/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${user.id}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setNotifications(data.data);
          setUnreadCount(data.data.filter((n: Notification) => !n.read).length);
        }
      });

    // Real-time subscription
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { notifications, unreadCount, setNotifications, setUnreadCount };
}
```

**Step 2: Build NotificationBell and NotificationPanel**

Use the `frontend-design` skill. Requirements:
- Bell icon in navbar with red badge showing unread count
- Dropdown panel with notification list
- Mark as read on click
- "Mark all as read" button
- Dark theme

**Step 3: Commit**

```bash
git add frontend/src/components/ui/ frontend/src/hooks/useNotifications.ts
git commit -m "feat: add real-time notification system with bell and panel"
```

---

### Task 27: Live Ticker Bar

**Files:**
- Create: `frontend/src/components/layout/TickerBar.tsx`
- Create: `frontend/src/hooks/useTickerStream.ts`

**Step 1: Create useTickerStream hook**

```typescript
"use client";

import { useEffect, useState, useRef } from "react";

interface TickerData {
  symbol: string;
  price: number;
  change: number;
}

export function useTickerStream(symbols: string[]) {
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`wss://ws.finnhub.io?token=${process.env.NEXT_PUBLIC_FINNHUB_KEY}`);
    wsRef.current = ws;

    ws.onopen = () => {
      symbols.forEach((s) => {
        ws.send(JSON.stringify({ type: "subscribe", symbol: s }));
      });
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "trade" && data.data) {
        for (const trade of data.data) {
          setTickers((prev) => ({
            ...prev,
            [trade.s]: {
              symbol: trade.s,
              price: trade.p,
              change: prev[trade.s]
                ? ((trade.p - prev[trade.s].price) / prev[trade.s].price) * 100
                : 0,
            },
          }));
        }
      }
    };

    return () => {
      symbols.forEach((s) => {
        ws.send(JSON.stringify({ type: "unsubscribe", symbol: s }));
      });
      ws.close();
    };
  }, []);

  return tickers;
}
```

**Step 2: Build TickerBar component**

Use the `frontend-design` skill. Requirements:
- Horizontal scrolling bar at bottom of home page or below navbar
- Shows symbol, price, change % with green ▲ / red ▼
- Smooth CSS marquee animation
- Default symbols: AAPL, MSFT, GOOGL, AMZN, TSLA, BTC (via Binance prefix or separate)
- Dark theme

**Step 3: Commit**

```bash
git add frontend/src/components/layout/TickerBar.tsx frontend/src/hooks/useTickerStream.ts
git commit -m "feat: add live ticker bar with Finnhub WebSocket streaming"
```

---

## Phase 5: Deployment

### Task 28: Backend Deployment (Railway)

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/railway.toml`

**Step 1: Create Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 2: Create railway.toml**

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/api/v1/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

**Step 3: Deploy to Railway**

- Create Railway project, connect GitHub repo
- Set environment variables from `.env.example`
- Deploy

**Step 4: Commit**

```bash
git add backend/Dockerfile backend/railway.toml
git commit -m "feat: add Dockerfile and Railway deployment config"
```

---

### Task 29: Frontend Deployment (Vercel)

**Step 1: Update next.config.js with production API URL**

Set `NEXT_PUBLIC_API_URL` environment variable in Vercel to point to Railway backend URL.

**Step 2: Deploy to Vercel**

- Connect GitHub repo to Vercel
- Set root directory to `frontend/`
- Set environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FINNHUB_KEY`
- Deploy

**Step 3: Configure Supabase Auth redirect URLs**

In Supabase dashboard → Authentication → URL Configuration:
- Site URL: `https://your-vercel-domain.vercel.app`
- Redirect URLs: `https://your-vercel-domain.vercel.app/auth/callback`

**Step 4: Commit any config changes**

```bash
git add .
git commit -m "feat: configure production deployment for Vercel"
```

---

## Phase 6: Integration Testing & Polish

### Task 30: End-to-End Smoke Test

**Steps:**
1. Trigger manual ingestion: hit `POST /api/v1/internal/ingest` (or wait for scheduler)
2. Verify articles appear: `GET /api/v1/articles`
3. Verify article detail: `GET /api/v1/articles/1`
4. Sign up via frontend, select favorite sectors
5. Take a quiz, verify XP and gauge update
6. Check leaderboard updates
7. Verify notifications arrive in real-time
8. Check ticker bar streams live prices

### Task 31: Final Commit & Tag

```bash
git tag v0.1.0
git push origin main --tags
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-5 | Database schema, backend scaffold, models, DB wrapper |
| 2 | 6-12 | Finnhub, GNews, Trafilatura, LLM, pipeline, gauge, XP, scheduler |
| 3 | 13-15 | All API routers |
| 4 | 16-27 | Frontend: scaffold, auth, pages, components, notifications, ticker |
| 5 | 28-29 | Railway + Vercel deployment |
| 6 | 30-31 | Integration testing and release |

Total: **31 tasks** across 6 phases.
