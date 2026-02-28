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
