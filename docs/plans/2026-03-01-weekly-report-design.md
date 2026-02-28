# Weekly Report Feature Design

## Overview

Personalized weekly reports for each user, delivered every Monday morning. Each report summarizes news from the user's favorite sectors for the prior week (Mon-Sun) and provides revision quizzes based on questions they got wrong.

## Delivery

- **In-app**: Dedicated section inside the user's profile page. Users can view current and past reports.
- **Email**: Summary email with key highlights and a "View full report" link to the in-app page.

## Data Layer Changes

### 1. Add `user_answers` to `quiz_attempts`

Add a nullable `user_answers` (integer array) column to the existing `quiz_attempts` table. Mirrors the pattern already used in `daily_quiz_attempts`. Existing rows remain unaffected.

### 2. New `weekly_reports` table

| Column | Type | Notes |
|--------|------|-------|
| id | int (PK) | Auto-increment |
| user_id | str (FK) | References profiles.id |
| week_start | date | Monday of the report week |
| week_end | date | Sunday of the report week |
| sector_summaries | jsonb | LLM-generated narrative per sector |
| revision_questions | jsonb | Wrong questions from the week |
| fresh_questions | jsonb | LLM-generated new questions from weak areas |
| stats | jsonb | Weekly stats snapshot |
| email_sent | bool | Default false |
| created_at | timestamptz | Auto-generated |

Unique constraint on `(user_id, week_start)`.

#### `sector_summaries` JSON shape

```json
[
  {
    "sector_id": 1,
    "sector_name": "Technology",
    "summary": "LLM-generated professional narrative...",
    "article_count": 12,
    "top_article_ids": [101, 105, 108]
  }
]
```

#### `revision_questions` JSON shape

```json
[
  {
    "source": "article_quiz" | "daily_quiz",
    "source_id": 42,
    "article_title": "...",
    "question_text": "...",
    "options": ["A", "B", "C", "D"],
    "correct_index": 2,
    "user_answer": 0,
    "explanation": "..."
  }
]
```

#### `fresh_questions` JSON shape

```json
[
  {
    "question_text": "...",
    "options": ["A", "B", "C", "D"],
    "correct_index": 1,
    "explanation": "...",
    "based_on_sector": "Technology"
  }
]
```

#### `stats` JSON shape

```json
{
  "articles_read": 15,
  "quizzes_taken": 8,
  "daily_quizzes_taken": 5,
  "total_questions": 40,
  "correct_answers": 28,
  "accuracy_pct": 70,
  "xp_earned": 350,
  "gauge_changes": [
    {"sector_name": "Technology", "start": 55, "end": 68}
  ]
}
```

## Backend: Report Generation Service

`backend/app/services/weekly_report.py`

### Generation flow

1. Query user's favorite sectors.
2. Fetch all articles from those sectors published in the Mon-Sun window.
3. For each sector, send articles (headlines + summaries) to LLM via OpenRouter. Prompt: generate a professional, concise weekly narrative.
4. Collect wrong answers from `daily_quiz_attempts` (has `answers` array) and `quiz_attempts` (new `user_answers` column) for the week.
5. Generate 5 fresh revision questions via LLM based on weak topics.
6. Compute weekly stats.
7. Store the report in `weekly_reports`.

### LLM prompt guidelines

- Professional, newsletter-style tone.
- Per-sector summary: 150-250 words.
- Cover key trends, major moves, notable events.
- Reference specific articles where relevant.

## Backend: Scheduler

Add a cron job to the existing APScheduler setup. Runs every Monday at 6:00 AM UTC.

1. Get all users who have at least one favorite sector.
2. For each user, generate the weekly report.
3. After report is stored, send summary email.
4. Mark `email_sent = true`.

## Backend: API Endpoints

`backend/app/routers/weekly_report.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/weekly-reports` | List user's reports (paginated, newest first) |
| GET | `/api/v1/weekly-reports/{id}` | Get full report by ID |
| GET | `/api/v1/weekly-reports/latest` | Get most recent report |
| POST | `/api/v1/weekly-reports/{id}/revision` | Submit revision quiz answers, returns results |

## Frontend: Profile Section

Add a "Weekly Reports" tab/section inside the profile page.

### Report list view

- Cards showing week range, summary preview, accuracy stat.
- Most recent report highlighted.

### Report detail view

- **Sector Summaries**: Polished, readable narrative per sector with professional formatting.
- **Your Week in Numbers**: Stats grid (articles, quizzes, accuracy, XP).
- **Revision Zone**: Two parts:
  1. Questions you got wrong (retake inline).
  2. Fresh challenge questions (new LLM-generated questions).
- Interactive quiz component — user answers, gets instant feedback.

## Email

Summary email containing:

- Greeting with user's display name.
- Quick stats (accuracy, XP earned, sectors covered).
- One-line teaser per sector summary.
- "View Full Report" CTA button linking to the in-app report.

Email sending via existing infrastructure or a simple SMTP/Resend integration.
