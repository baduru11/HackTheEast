# Weekly Report Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate personalized weekly reports for each user every Monday, summarizing their favorite sectors' news and providing revision quizzes from wrong answers.

**Architecture:** Backend service generates reports via scheduler cron job (Monday 6AM UTC). Reports are stored in `weekly_reports` table. A new router exposes report endpoints. The frontend adds a "Weekly Reports" section inside the profile page. Email summary links back to the in-app report.

**Tech Stack:** FastAPI, Supabase (Postgres), OpenRouter LLM, Next.js, Tailwind CSS, Resend (email)

---

### Task 1: Database Migration — Add `user_answers` to `quiz_attempts`

**Files:**
- Migration via Supabase MCP tool

**Step 1: Apply migration**

Run Supabase migration `add_user_answers_to_quiz_attempts`:

```sql
ALTER TABLE quiz_attempts
ADD COLUMN user_answers integer[] DEFAULT NULL;
```

**Step 2: Verify**

Run SQL: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'quiz_attempts' AND column_name = 'user_answers';`

Expected: 1 row with `data_type = 'ARRAY'`

---

### Task 2: Database Migration — Create `weekly_reports` table

**Files:**
- Migration via Supabase MCP tool

**Step 1: Apply migration**

Run Supabase migration `create_weekly_reports_table`:

```sql
CREATE TABLE weekly_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  sector_summaries JSONB NOT NULL DEFAULT '[]'::jsonb,
  revision_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  fresh_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX idx_weekly_reports_user_id ON weekly_reports(user_id);
CREATE INDEX idx_weekly_reports_week_start ON weekly_reports(week_start DESC);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reports"
  ON weekly_reports FOR SELECT
  USING (auth.uid() = user_id);
```

**Step 2: Verify**

Run SQL: `SELECT table_name FROM information_schema.tables WHERE table_name = 'weekly_reports';`

Expected: 1 row

---

### Task 3: Backend — Save `user_answers` on quiz submission

**Files:**
- Modify: `backend/app/db/supabase.py:151-158` (insert_quiz_attempt)
- Modify: `backend/app/routers/quizzes.py:101` (submit_quiz call)

**Step 1: Update `insert_quiz_attempt` to accept `user_answers`**

In `backend/app/db/supabase.py`, change:

```python
async def insert_quiz_attempt(user_id: str, quiz_id: int, score: int, total: int, xp: int):
    supabase.table("quiz_attempts").insert({
        "user_id": user_id,
        "quiz_id": quiz_id,
        "score": score,
        "total_questions": total,
        "xp_earned": xp,
    }).execute()
```

To:

```python
async def insert_quiz_attempt(user_id: str, quiz_id: int, score: int, total: int, xp: int, user_answers: list[int] | None = None):
    row = {
        "user_id": user_id,
        "quiz_id": quiz_id,
        "score": score,
        "total_questions": total,
        "xp_earned": xp,
    }
    if user_answers is not None:
        row["user_answers"] = user_answers
    supabase.table("quiz_attempts").insert(row).execute()
```

**Step 2: Pass `user_answers` from quiz router**

In `backend/app/routers/quizzes.py`, change line 101:

```python
await db.insert_quiz_attempt(user_id, quiz["id"], score, total, xp_earned)
```

To:

```python
await db.insert_quiz_attempt(user_id, quiz["id"], score, total, xp_earned, user_answers=submission.answers)
```

**Step 3: Commit**

```bash
git add backend/app/db/supabase.py backend/app/routers/quizzes.py
git commit -m "feat: save user_answers on article quiz submission"
```

---

### Task 4: Backend — Weekly report DB functions

**Files:**
- Modify: `backend/app/db/supabase.py` (append new functions)

**Step 1: Add weekly report CRUD functions**

Append to `backend/app/db/supabase.py`:

```python
# --- Weekly Reports ---

async def get_weekly_report(report_id: int, user_id: str):
    result = supabase.table("weekly_reports").select("*").eq("id", report_id).eq("user_id", user_id).single().execute()
    return result.data


async def get_latest_weekly_report(user_id: str):
    result = supabase.table("weekly_reports").select("*").eq("user_id", user_id).order("week_start", desc=True).limit(1).execute()
    return result.data[0] if result.data else None


async def get_weekly_reports(user_id: str, page: int = 1, limit: int = 10):
    offset = (page - 1) * limit
    result = supabase.table("weekly_reports").select("*", count="exact").eq(
        "user_id", user_id
    ).order("week_start", desc=True).range(offset, offset + limit - 1).execute()
    return result.data, result.count


async def insert_weekly_report(data: dict):
    result = supabase.table("weekly_reports").insert(data).execute()
    return result.data[0] if result.data else None


async def update_weekly_report(report_id: int, data: dict):
    supabase.table("weekly_reports").update(data).eq("id", report_id).execute()


async def get_users_with_favorites():
    """Get distinct user_ids that have at least one favorite sector."""
    result = supabase.table("user_favorites").select("user_id").execute()
    return list(set(r["user_id"] for r in result.data))


async def get_user_quiz_attempts_for_week(user_id: str, week_start: str, week_end: str):
    """Get all quiz attempts for a user within a date range, with questions."""
    result = supabase.table("quiz_attempts").select(
        "*, quizzes(article_id, quiz_questions(question_text, options, correct_index, explanation))"
    ).eq("user_id", user_id).gte("completed_at", week_start).lte("completed_at", week_end).execute()
    return result.data or []


async def get_user_daily_quiz_attempts_for_week(user_id: str, week_start: str, week_end: str):
    """Get all daily quiz attempts for a user within a date range."""
    result = supabase.table("daily_quiz_attempts").select(
        "*, daily_quizzes(questions)"
    ).eq("user_id", user_id).gte("completed_at", week_start).lte("completed_at", week_end).execute()
    return result.data or []


async def get_articles_for_sectors_in_range(sector_ids: list[int], start_date: str, end_date: str):
    """Get articles published in a date range for given sectors."""
    article_ids_result = supabase.table("article_sectors").select("article_id").in_("sector_id", sector_ids).execute()
    ids = list(set(r["article_id"] for r in article_ids_result.data))
    if not ids:
        return []
    result = supabase.table("articles").select(
        "id, headline, ai_summary, published_at, article_sectors(sector_id)"
    ).eq("processing_status", "done").in_("id", ids).gte("published_at", start_date).lte("published_at", end_date).order("published_at", desc=True).execute()
    return result.data or []
```

**Step 2: Commit**

```bash
git add backend/app/db/supabase.py
git commit -m "feat: add weekly report database functions"
```

---

### Task 5: Backend — LLM sector summary generation

**Files:**
- Modify: `backend/app/services/llm.py` (append new functions)

**Step 1: Add sector summary and revision quiz generation**

Append to `backend/app/services/llm.py`:

```python
async def generate_sector_weekly_summary(sector_name: str, articles: list[dict]) -> str | None:
    """Generate a professional weekly narrative summary for a sector."""
    if not articles:
        return None

    article_texts = []
    for a in articles[:15]:  # Limit to top 15 articles
        article_texts.append(f"- {a['headline']}: {(a.get('ai_summary') or '')[:200]}")

    articles_block = "\n".join(article_texts)

    prompt = f"""Summarize the key developments in the {sector_name} sector from the past week based on these articles:

{articles_block}

Write a professional, newsletter-style summary in 150-250 words. Cover:
- Key trends and themes
- Major market moves or events
- Notable developments
- What to watch going forward

Tone: Authoritative but accessible. Like a Bloomberg or Reuters weekly briefing.
Return ONLY the summary text, no JSON wrapping."""

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
                        {"role": "system", "content": "You are a senior financial analyst writing weekly sector briefings. Write clearly and professionally."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.4,
                },
            )
            response.raise_for_status()
            data = response.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"Sector summary LLM error for {sector_name}: {e}")
        return None


async def generate_revision_questions(wrong_topics: list[str], sector_names: list[str]) -> list[dict]:
    """Generate fresh revision questions based on topics the user struggled with."""
    if not wrong_topics:
        return []

    topics_block = "\n".join(f"- {t}" for t in wrong_topics[:10])
    sectors_block = ", ".join(sector_names)

    prompt = f"""A user got these financial concepts/questions wrong this week:

{topics_block}

Their favorite sectors: {sectors_block}

Generate exactly 5 fresh multiple-choice questions that test understanding of these weak areas. Each question should approach the concept from a different angle than the original.

Return a JSON array of objects with:
- "question_text": the question
- "options": array of exactly 4 answer strings
- "correct_index": integer 0-3
- "explanation": brief explanation
- "based_on_topic": which weak topic this addresses

Return ONLY the JSON array."""

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
                        {"role": "system", "content": "You are a financial education quiz generator. Return only valid JSON."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.4,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        if isinstance(parsed, dict) and "questions" in parsed:
            return parsed["questions"][:5]
        elif isinstance(parsed, list):
            return parsed[:5]
        return []
    except Exception as e:
        print(f"Revision quiz LLM error: {e}")
        return []
```

**Step 2: Commit**

```bash
git add backend/app/services/llm.py
git commit -m "feat: add LLM functions for sector summaries and revision quizzes"
```

---

### Task 6: Backend — Weekly report generation service

**Files:**
- Create: `backend/app/services/weekly_report.py`

**Step 1: Create the service**

```python
from datetime import datetime, timedelta

from app.db import supabase as db
from app.services.llm import generate_sector_weekly_summary, generate_revision_questions


async def generate_weekly_report(user_id: str, week_start: datetime, week_end: datetime) -> dict | None:
    """Generate a complete weekly report for a single user."""
    start_str = week_start.isoformat()
    end_str = week_end.isoformat()

    # 1. Get user's favorite sectors
    favorites = await db.get_user_favorites(user_id)
    if not favorites:
        return None

    sector_ids = [f["sector_id"] for f in favorites]
    sector_map = {f["sector_id"]: f["sectors"]["name"] for f in favorites}

    # 2. Get articles for these sectors in the date range
    articles = await db.get_articles_for_sectors_in_range(sector_ids, start_str, end_str)

    # Group articles by sector
    articles_by_sector: dict[int, list[dict]] = {sid: [] for sid in sector_ids}
    for article in articles:
        for sec in article.get("article_sectors", []):
            sid = sec["sector_id"]
            if sid in articles_by_sector:
                articles_by_sector[sid].append(article)

    # 3. Generate LLM summaries per sector
    sector_summaries = []
    for sid in sector_ids:
        sector_articles = articles_by_sector.get(sid, [])
        summary_text = await generate_sector_weekly_summary(
            sector_map[sid], sector_articles
        )
        sector_summaries.append({
            "sector_id": sid,
            "sector_name": sector_map[sid],
            "summary": summary_text or "No significant activity this week.",
            "article_count": len(sector_articles),
            "top_article_ids": [a["id"] for a in sector_articles[:5]],
        })

    # 4. Collect wrong answers from article quizzes
    revision_questions = []
    wrong_topics = []

    article_attempts = await db.get_user_quiz_attempts_for_week(user_id, start_str, end_str)
    for attempt in article_attempts:
        user_answers = attempt.get("user_answers")
        if not user_answers:
            continue
        quiz_data = attempt.get("quizzes", {})
        questions = quiz_data.get("quiz_questions", [])
        article_id = quiz_data.get("article_id")
        # Get article headline
        article = await db.get_article_by_id(article_id) if article_id else None
        article_title = (article or {}).get("headline", "Unknown article")
        for i, q in enumerate(questions):
            if i < len(user_answers) and user_answers[i] != q["correct_index"]:
                revision_questions.append({
                    "source": "article_quiz",
                    "source_id": attempt.get("quiz_id"),
                    "article_title": article_title,
                    "question_text": q["question_text"],
                    "options": q["options"],
                    "correct_index": q["correct_index"],
                    "user_answer": user_answers[i],
                    "explanation": q["explanation"],
                })
                wrong_topics.append(q["question_text"])

    # 5. Collect wrong answers from daily quizzes
    daily_attempts = await db.get_user_daily_quiz_attempts_for_week(user_id, start_str, end_str)
    for attempt in daily_attempts:
        user_answers = attempt.get("answers", [])
        daily_quiz = attempt.get("daily_quizzes", {})
        questions = daily_quiz.get("questions", [])
        for i, q in enumerate(questions):
            if i < len(user_answers) and user_answers[i] != q["correct_index"]:
                revision_questions.append({
                    "source": "daily_quiz",
                    "source_id": attempt.get("quiz_id"),
                    "article_title": "Daily Quiz",
                    "question_text": q["question_text"],
                    "options": q["options"],
                    "correct_index": q["correct_index"],
                    "user_answer": user_answers[i],
                    "explanation": q["explanation"],
                })
                wrong_topics.append(q["question_text"])

    # 6. Generate fresh revision questions via LLM
    sector_names = [sector_map[sid] for sid in sector_ids]
    fresh_questions = await generate_revision_questions(wrong_topics, sector_names)

    # 7. Compute stats
    total_article_quizzes = len(article_attempts)
    total_daily_quizzes = len(daily_attempts)
    total_questions = sum(a.get("total_questions", 0) for a in article_attempts) + sum(a.get("total_questions", 0) for a in daily_attempts)
    correct_answers = sum(a.get("score", 0) for a in article_attempts) + sum(a.get("score", 0) for a in daily_attempts)
    xp_earned = sum(a.get("xp_earned", 0) for a in article_attempts) + sum(a.get("xp_earned", 0) for a in daily_attempts)

    # Gauge changes
    gauge_changes = []
    for fav in favorites:
        gauge_changes.append({
            "sector_name": fav["sectors"]["name"],
            "current": fav["gauge_score"],
        })

    stats = {
        "articles_in_sectors": len(articles),
        "quizzes_taken": total_article_quizzes,
        "daily_quizzes_taken": total_daily_quizzes,
        "total_questions": total_questions,
        "correct_answers": correct_answers,
        "accuracy_pct": round(correct_answers * 100 / total_questions) if total_questions > 0 else 0,
        "xp_earned": xp_earned,
        "gauge_snapshot": gauge_changes,
    }

    # 8. Store the report
    report = await db.insert_weekly_report({
        "user_id": user_id,
        "week_start": week_start.date().isoformat(),
        "week_end": week_end.date().isoformat(),
        "sector_summaries": sector_summaries,
        "revision_questions": revision_questions,
        "fresh_questions": fresh_questions,
        "stats": stats,
    })

    return report


async def generate_all_weekly_reports():
    """Generate weekly reports for all users with favorites. Called by scheduler."""
    # Calculate last week's Mon-Sun
    today = datetime.utcnow()
    # Find the most recent Monday (could be today if Monday)
    days_since_monday = today.weekday()  # Monday = 0
    this_monday = today.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_since_monday)
    last_monday = this_monday - timedelta(days=7)
    last_sunday = this_monday - timedelta(seconds=1)  # End of Sunday 23:59:59

    user_ids = await db.get_users_with_favorites()
    print(f"[weekly_report] generating reports for {len(user_ids)} users, week {last_monday.date()} to {last_sunday.date()}")

    for user_id in user_ids:
        try:
            report = await generate_weekly_report(user_id, last_monday, last_sunday)
            if report:
                print(f"[weekly_report] generated report #{report['id']} for user {user_id}")
                # Send email notification
                await db.insert_notification(
                    user_id=user_id,
                    type="weekly_report",
                    title="Your Weekly Report is Ready",
                    body="Check out your personalized sector summary and revision quiz.",
                    link="/profile#weekly-reports",
                )
        except Exception as e:
            print(f"[weekly_report] error for user {user_id}: {e}")

    print(f"[weekly_report] done")
```

**Step 2: Commit**

```bash
git add backend/app/services/weekly_report.py
git commit -m "feat: add weekly report generation service"
```

---

### Task 7: Backend — Weekly report API router

**Files:**
- Create: `backend/app/routers/weekly_report.py`
- Modify: `backend/app/main.py` (register router)

**Step 1: Create the router**

```python
from fastapi import APIRouter, Depends

from app.db import supabase as db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/weekly-reports", tags=["weekly-reports"])


@router.get("/")
async def list_reports(page: int = 1, limit: int = 10, user_id: str = Depends(get_current_user)):
    reports, total = await db.get_weekly_reports(user_id, page, limit)
    return {
        "success": True,
        "data": reports,
        "meta": {"total": total, "page": page, "limit": limit},
    }


@router.get("/latest")
async def get_latest_report(user_id: str = Depends(get_current_user)):
    report = await db.get_latest_weekly_report(user_id)
    if not report:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "No weekly reports yet"}}
    return {"success": True, "data": report}


@router.get("/{report_id}")
async def get_report(report_id: int, user_id: str = Depends(get_current_user)):
    report = await db.get_weekly_report(report_id, user_id)
    if not report:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Report not found"}}
    return {"success": True, "data": report}


@router.post("/{report_id}/revision")
async def submit_revision(report_id: int, body: dict, user_id: str = Depends(get_current_user)):
    """Submit answers for revision quiz (both retake + fresh questions). Returns graded results."""
    report = await db.get_weekly_report(report_id, user_id)
    if not report:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Report not found"}}

    answers = body.get("answers", [])
    quiz_type = body.get("type", "revision")  # "revision" or "fresh"

    if quiz_type == "fresh":
        questions = report.get("fresh_questions", [])
    else:
        questions = report.get("revision_questions", [])

    if len(answers) != len(questions):
        return {"success": False, "error": {"code": "INVALID_ANSWERS", "message": f"Expected {len(questions)} answers"}}

    score = 0
    feedback = []
    for i, q in enumerate(questions):
        is_correct = answers[i] == q["correct_index"]
        if is_correct:
            score += 1
        feedback.append({
            "question_text": q["question_text"],
            "your_answer": answers[i],
            "correct_answer": q["correct_index"],
            "is_correct": is_correct,
            "explanation": q["explanation"],
        })

    return {
        "success": True,
        "data": {
            "score": score,
            "total": len(questions),
            "feedback": feedback,
        },
    }
```

**Step 2: Register router in `main.py`**

In `backend/app/main.py`, add import:

```python
from app.routers import articles, quizzes, profile, favorites, leaderboard, notifications, sectors, market, friends, social, daily_quiz, predict, weekly_report
```

And add:

```python
app.include_router(weekly_report.router)
```

**Step 3: Commit**

```bash
git add backend/app/routers/weekly_report.py backend/app/main.py
git commit -m "feat: add weekly report API endpoints"
```

---

### Task 8: Backend — Scheduler cron job for weekly reports

**Files:**
- Modify: `backend/app/scheduler/jobs.py`

**Step 1: Add the weekly report job**

Add import at top of `backend/app/scheduler/jobs.py`:

```python
from app.services.weekly_report import generate_all_weekly_reports
```

Add the cron function (after `_cleanup_notifications_daily`):

```python
async def _generate_weekly_reports():
    """Fire every Monday at 06:00 UTC."""
    while True:
        now = datetime.utcnow()
        # Find next Monday
        days_until_monday = (7 - now.weekday()) % 7
        if days_until_monday == 0 and now.hour >= 6:
            days_until_monday = 7
        next_monday = (now + timedelta(days=days_until_monday)).replace(
            hour=6, minute=0, second=0, microsecond=0
        )
        await asyncio.sleep((next_monday - now).total_seconds())
        try:
            print("[scheduler] running: weekly_reports")
            await generate_all_weekly_reports()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"[scheduler] 'weekly_reports' error: {e}")
```

Add to `_tasks` list in `setup_scheduler()`:

```python
# Weekly report generation every Monday 6 AM UTC
asyncio.create_task(_generate_weekly_reports(), name="weekly_reports"),
```

**Step 2: Commit**

```bash
git add backend/app/scheduler/jobs.py
git commit -m "feat: add weekly report scheduler job (Monday 6AM UTC)"
```

---

### Task 9: Frontend — Weekly reports section in profile page

**Files:**
- Create: `frontend/src/components/profile/WeeklyReports.tsx`
- Modify: `frontend/src/app/profile/page.tsx`

**Step 1: Create WeeklyReports component**

Create `frontend/src/components/profile/WeeklyReports.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { FadeInUp, StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";

interface SectorSummary {
  sector_id: number;
  sector_name: string;
  summary: string;
  article_count: number;
}

interface RevisionQuestion {
  source: string;
  article_title: string;
  question_text: string;
  options: string[];
  correct_index: number;
  user_answer: number;
  explanation: string;
}

interface FreshQuestion {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  based_on_topic: string;
}

interface ReportStats {
  articles_in_sectors: number;
  quizzes_taken: number;
  daily_quizzes_taken: number;
  total_questions: number;
  correct_answers: number;
  accuracy_pct: number;
  xp_earned: number;
}

interface WeeklyReport {
  id: number;
  week_start: string;
  week_end: string;
  sector_summaries: SectorSummary[];
  revision_questions: RevisionQuestion[];
  fresh_questions: FreshQuestion[];
  stats: ReportStats;
  created_at: string;
}

export default function WeeklyReports({ token }: { token: string }) {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [selected, setSelected] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary" | "revision" | "fresh">("summary");

  // Revision quiz state
  const [revisionAnswers, setRevisionAnswers] = useState<Record<number, number>>({});
  const [revisionSubmitted, setRevisionSubmitted] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState<{ score: number; total: number; feedback: { is_correct: boolean; correct_answer: number; explanation: string }[] } | null>(null);

  // Fresh quiz state
  const [freshAnswers, setFreshAnswers] = useState<Record<number, number>>({});
  const [freshSubmitted, setFreshSubmitted] = useState(false);
  const [freshFeedback, setFreshFeedback] = useState<{ score: number; total: number; feedback: { is_correct: boolean; correct_answer: number; explanation: string }[] } | null>(null);

  useEffect(() => {
    apiFetch<WeeklyReport[]>("/weekly-reports", { token })
      .then((res) => {
        if (res.success && res.data) {
          setReports(res.data);
          if (res.data.length > 0) setSelected(res.data[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const formatWeek = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${s.toLocaleDateString("en-US", opts)} — ${e.toLocaleDateString("en-US", opts)}`;
  };

  const submitRevision = async () => {
    if (!selected) return;
    const answers = selected.revision_questions.map((_, i) => revisionAnswers[i] ?? -1);
    const res = await apiFetch<{ score: number; total: number; feedback: any[] }>(`/weekly-reports/${selected.id}/revision`, {
      token,
      method: "POST",
      body: JSON.stringify({ answers, type: "revision" }),
    });
    if (res.success && res.data) {
      setRevisionFeedback(res.data);
      setRevisionSubmitted(true);
    }
  };

  const submitFresh = async () => {
    if (!selected) return;
    const answers = selected.fresh_questions.map((_, i) => freshAnswers[i] ?? -1);
    const res = await apiFetch<{ score: number; total: number; feedback: any[] }>(`/weekly-reports/${selected.id}/revision`, {
      token,
      method: "POST",
      body: JSON.stringify({ answers, type: "fresh" }),
    });
    if (res.success && res.data) {
      setFreshFeedback(res.data);
      setFreshSubmitted(true);
    }
  };

  // Reset quiz state when switching reports
  useEffect(() => {
    setRevisionAnswers({});
    setRevisionSubmitted(false);
    setRevisionFeedback(null);
    setFreshAnswers({});
    setFreshSubmitted(false);
    setFreshFeedback(null);
    setTab("summary");
  }, [selected?.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 skeleton-shimmer rounded-lg w-48" />
        <div className="h-64 skeleton-shimmer rounded-xl" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-900 border border-gray-800 rounded-xl">
        <p className="text-gray-400">No weekly reports yet.</p>
        <p className="text-gray-500 text-sm mt-1">Your first report will be generated next Monday.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Report selector */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r)}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selected?.id === r.id
                ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                : "bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-700"
            }`}
          >
            {formatWeek(r.week_start, r.week_end)}
          </button>
        ))}
      </div>

      {selected && (
        <FadeInUp key={selected.id}>
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Accuracy", value: `${selected.stats.accuracy_pct}%`, color: "text-teal-400" },
              { label: "XP Earned", value: `+${selected.stats.xp_earned}`, color: "text-yellow-400" },
              { label: "Quizzes", value: `${selected.stats.quizzes_taken + selected.stats.daily_quizzes_taken}`, color: "text-blue-400" },
              { label: "Articles", value: `${selected.stats.articles_in_sectors}`, color: "text-purple-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800 mb-6">
            {(
              [
                { key: "summary" as const, label: "Sector Summaries" },
                { key: "revision" as const, label: `Retake (${selected.revision_questions.length})` },
                { key: "fresh" as const, label: `Challenge (${selected.fresh_questions.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === t.key
                    ? "border-teal-400 text-teal-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "summary" && (
            <StaggerList className="space-y-4">
              {selected.sector_summaries.map((s) => (
                <StaggerItem key={s.sector_id}>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-white">{s.sector_name}</h3>
                      <span className="text-xs text-gray-500">{s.article_count} articles</span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{s.summary}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerList>
          )}

          {tab === "revision" && (
            <div className="space-y-4">
              {selected.revision_questions.length === 0 ? (
                <div className="text-center py-8 bg-gray-900 border border-gray-800 rounded-xl">
                  <p className="text-gray-400">Perfect week! No wrong answers to review.</p>
                </div>
              ) : (
                <>
                  {selected.revision_questions.map((q, i) => (
                    <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                      <p className="text-xs text-gray-500 mb-2">{q.article_title}</p>
                      <p className="text-sm text-white font-medium mb-3">{q.question_text}</p>
                      <div className="grid grid-cols-1 gap-2">
                        {q.options.map((opt, oi) => {
                          const isSelected = revisionAnswers[i] === oi;
                          const showResult = revisionSubmitted && revisionFeedback;
                          const isCorrect = showResult && oi === revisionFeedback.feedback[i]?.correct_answer;
                          const isWrong = showResult && isSelected && !revisionFeedback.feedback[i]?.is_correct;

                          return (
                            <button
                              key={oi}
                              onClick={() => !revisionSubmitted && setRevisionAnswers({ ...revisionAnswers, [i]: oi })}
                              disabled={revisionSubmitted}
                              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                                isCorrect
                                  ? "border-green-500/50 bg-green-500/10 text-green-400"
                                  : isWrong
                                  ? "border-red-500/50 bg-red-500/10 text-red-400"
                                  : isSelected
                                  ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                                  : "border-gray-700 text-gray-400 hover:border-gray-600"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {revisionSubmitted && revisionFeedback && (
                        <p className="text-xs text-gray-400 mt-3 bg-gray-800/50 rounded-lg p-2">
                          {revisionFeedback.feedback[i]?.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                  {!revisionSubmitted && (
                    <button
                      onClick={submitRevision}
                      disabled={Object.keys(revisionAnswers).length !== selected.revision_questions.length}
                      className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
                    >
                      Submit Answers
                    </button>
                  )}
                  {revisionSubmitted && revisionFeedback && (
                    <div className="text-center py-3 bg-gray-900 border border-gray-800 rounded-xl">
                      <p className="text-lg font-bold text-white">
                        {revisionFeedback.score}/{revisionFeedback.total} correct
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "fresh" && (
            <div className="space-y-4">
              {selected.fresh_questions.length === 0 ? (
                <div className="text-center py-8 bg-gray-900 border border-gray-800 rounded-xl">
                  <p className="text-gray-400">No challenge questions this week.</p>
                </div>
              ) : (
                <>
                  {selected.fresh_questions.map((q, i) => (
                    <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                      <p className="text-sm text-white font-medium mb-3">{q.question_text}</p>
                      <div className="grid grid-cols-1 gap-2">
                        {q.options.map((opt, oi) => {
                          const isSelected = freshAnswers[i] === oi;
                          const showResult = freshSubmitted && freshFeedback;
                          const isCorrect = showResult && oi === freshFeedback.feedback[i]?.correct_answer;
                          const isWrong = showResult && isSelected && !freshFeedback.feedback[i]?.is_correct;

                          return (
                            <button
                              key={oi}
                              onClick={() => !freshSubmitted && setFreshAnswers({ ...freshAnswers, [i]: oi })}
                              disabled={freshSubmitted}
                              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                                isCorrect
                                  ? "border-green-500/50 bg-green-500/10 text-green-400"
                                  : isWrong
                                  ? "border-red-500/50 bg-red-500/10 text-red-400"
                                  : isSelected
                                  ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                                  : "border-gray-700 text-gray-400 hover:border-gray-600"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {freshSubmitted && freshFeedback && (
                        <p className="text-xs text-gray-400 mt-3 bg-gray-800/50 rounded-lg p-2">
                          {freshFeedback.feedback[i]?.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                  {!freshSubmitted && (
                    <button
                      onClick={submitFresh}
                      disabled={Object.keys(freshAnswers).length !== selected.fresh_questions.length}
                      className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
                    >
                      Submit Answers
                    </button>
                  )}
                  {freshSubmitted && freshFeedback && (
                    <div className="text-center py-3 bg-gray-900 border border-gray-800 rounded-xl">
                      <p className="text-lg font-bold text-white">
                        {freshFeedback.score}/{freshFeedback.total} correct
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </FadeInUp>
      )}
    </div>
  );
}
```

**Step 2: Add WeeklyReports to profile page**

In `frontend/src/app/profile/page.tsx`, add import:

```tsx
import WeeklyReports from "@/components/profile/WeeklyReports";
```

Add the section after the Sectors section (before the closing `</div>` of the main container), around line 221:

```tsx
        {/* Weekly Reports */}
        <h2 id="weekly-reports" className="text-lg font-bold text-white mb-4 mt-8">Weekly Reports</h2>
        <WeeklyReports token={session.access_token} />
```

**Step 3: Commit**

```bash
git add frontend/src/components/profile/WeeklyReports.tsx frontend/src/app/profile/page.tsx
git commit -m "feat: add weekly reports section to profile page"
```

---

### Task 10: Backend — Email summary (Resend)

**Files:**
- Create: `backend/app/services/email.py`
- Modify: `backend/app/config.py` (add resend_api_key)
- Modify: `backend/app/services/weekly_report.py` (call email after report generation)

**Step 1: Add `resend_api_key` to config**

In `backend/app/config.py`, add to `Settings`:

```python
resend_api_key: str = ""
```

**Step 2: Create email service**

Create `backend/app/services/email.py`:

```python
import httpx

from app.config import settings

RESEND_URL = "https://api.resend.com/emails"


async def send_weekly_report_email(
    to_email: str,
    display_name: str,
    report: dict,
    app_url: str = "https://finameter.com",
):
    """Send a weekly report summary email via Resend."""
    if not settings.resend_api_key:
        print("[email] resend_api_key not set, skipping email")
        return

    stats = report.get("stats", {})
    sector_summaries = report.get("sector_summaries", [])
    report_id = report.get("id", "")

    # Build sector teasers
    sector_lines = ""
    for s in sector_summaries:
        teaser = (s.get("summary") or "")[:120]
        if len(s.get("summary", "")) > 120:
            teaser += "..."
        sector_lines += f"<tr><td style='padding:8px 0;border-bottom:1px solid #2d2d2d'><strong style='color:#fff'>{s['sector_name']}</strong><br><span style='color:#9ca3af;font-size:13px'>{teaser}</span></td></tr>"

    html = f"""
    <div style="max-width:560px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#111;color:#e5e7eb;padding:32px;border-radius:12px">
      <h1 style="color:#fff;font-size:22px;margin:0 0 4px">Your Weekly Report</h1>
      <p style="color:#6b7280;font-size:13px;margin:0 0 24px">Hi {display_name}, here's your week in review.</p>

      <div style="display:flex;gap:12px;margin-bottom:24px">
        <div style="flex:1;background:#1a1a1a;border-radius:8px;padding:12px;text-align:center">
          <div style="color:#2dd4bf;font-size:20px;font-weight:700">{stats.get('accuracy_pct', 0)}%</div>
          <div style="color:#6b7280;font-size:11px">Accuracy</div>
        </div>
        <div style="flex:1;background:#1a1a1a;border-radius:8px;padding:12px;text-align:center">
          <div style="color:#facc15;font-size:20px;font-weight:700">+{stats.get('xp_earned', 0)}</div>
          <div style="color:#6b7280;font-size:11px">XP Earned</div>
        </div>
        <div style="flex:1;background:#1a1a1a;border-radius:8px;padding:12px;text-align:center">
          <div style="color:#60a5fa;font-size:20px;font-weight:700">{stats.get('quizzes_taken', 0) + stats.get('daily_quizzes_taken', 0)}</div>
          <div style="color:#6b7280;font-size:11px">Quizzes</div>
        </div>
      </div>

      <h2 style="color:#fff;font-size:16px;margin:0 0 12px">Sector Highlights</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">{sector_lines}</table>

      <a href="{app_url}/profile#weekly-reports" style="display:block;text-align:center;background:#14b8a6;color:#fff;text-decoration:none;padding:12px;border-radius:8px;font-weight:600;font-size:14px">
        View Full Report
      </a>

      <p style="color:#4b5563;font-size:11px;text-align:center;margin:20px 0 0">FinaMeter — Learn finance, one article at a time.</p>
    </div>
    """

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(
                RESEND_URL,
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "FinaMeter <reports@finameter.com>",
                    "to": to_email,
                    "subject": f"Your Weekly Report — {stats.get('accuracy_pct', 0)}% accuracy this week",
                    "html": html,
                },
            )
    except Exception as e:
        print(f"[email] failed to send weekly report email: {e}")
```

**Step 3: Wire email into report generation**

In `backend/app/services/weekly_report.py`, add import at top:

```python
from app.services.email import send_weekly_report_email
```

In `generate_all_weekly_reports`, after the report is generated and notification inserted, add email sending. Replace the block inside the try after `insert_notification`:

```python
# Send email
profile = await db.get_profile(user_id)
if profile:
    # Get user email from Supabase auth
    from app.dependencies import supabase as sb_client
    try:
        auth_user = sb_client.auth.admin.get_user_by_id(user_id)
        if auth_user and auth_user.user and auth_user.user.email:
            await send_weekly_report_email(
                to_email=auth_user.user.email,
                display_name=profile.get("display_name") or profile.get("username") or "there",
                report=report,
            )
            await db.update_weekly_report(report["id"], {"email_sent": True})
    except Exception as email_err:
        print(f"[weekly_report] email error for {user_id}: {email_err}")
```

**Step 4: Commit**

```bash
git add backend/app/services/email.py backend/app/config.py backend/app/services/weekly_report.py
git commit -m "feat: add email summary for weekly reports via Resend"
```

---

### Task 11: Backend — Manual trigger endpoint for testing

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Add debug trigger**

Add after the existing `trigger-ingest` endpoint in `backend/app/main.py`:

```python
@app.post("/api/v1/health/trigger-weekly-report")
async def trigger_weekly_report():
    """Manually trigger weekly report generation — for debugging."""
    from app.services.weekly_report import generate_all_weekly_reports
    await generate_all_weekly_reports()
    return {"status": "ok", "triggered": True}
```

**Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add debug endpoint for manual weekly report generation"
```

---

### Task 12: Verify and test end-to-end

**Step 1: Run the backend**

```bash
cd backend && uvicorn app.main:app --reload
```

Verify no import errors.

**Step 2: Test the trigger**

```bash
curl -X POST http://localhost:8000/api/v1/health/trigger-weekly-report
```

Expected: `{"status": "ok", "triggered": true}`

**Step 3: Test the API**

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/weekly-reports/
```

Expected: `{"success": true, "data": [...], "meta": {...}}`

**Step 4: Test the frontend**

Visit `/profile` and scroll to "Weekly Reports" section. Verify:
- Report selector shows week ranges
- Sector summaries render with professional text
- Retake tab shows wrong questions with answer buttons
- Challenge tab shows fresh LLM-generated questions
- Submitting answers shows graded results with explanations

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete weekly report feature — backend, frontend, email"
```
