import json
import logging
from datetime import date, timezone, datetime

from app.db import supabase as db
from app.services.llm import generate_daily_quiz_questions

logger = logging.getLogger(__name__)


async def get_or_create_daily_quiz(target_date: str | None = None):
    today = target_date or date.today().isoformat()

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
