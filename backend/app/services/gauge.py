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
        if pending >= 6:
            decay = 15
        elif pending >= 4:
            decay = 10
        elif pending >= 2:
            decay = 5
        else:
            decay = 0

        # Weekend modifier
        if datetime.utcnow().weekday() >= 5:
            decay = decay // 2

        if decay > 0:
            new_score = max(current_score - decay, 20)  # Floor at 20
            await db.update_gauge(user_id, sector_id, new_score)


async def _count_pending_articles(user_id: str, sector_id: int) -> int:
    """Count articles in sector that user hasn't quizzed on, older than 30 min."""
    from app.dependencies import supabase

    cutoff = (datetime.utcnow() - timedelta(minutes=30)).isoformat()
    day_ago = (datetime.utcnow() - timedelta(hours=24)).isoformat()

    # Filter at DB level: only articles from last 24h, older than 30 min
    articles = supabase.table("articles").select(
        "id"
    ).eq("processing_status", "done").lt(
        "created_at", cutoff
    ).gt(
        "created_at", day_ago
    ).in_(
        "id",
        [r["article_id"] for r in supabase.table("article_sectors").select("article_id").eq("sector_id", sector_id).execute().data]
    ).execute()

    if not articles.data:
        return 0

    article_ids = [a["id"] for a in articles.data]

    # Check which ones user has already quizzed on
    quizzes = supabase.table("quizzes").select("id, article_id").in_("article_id", article_ids).execute()
    quiz_ids = [q["id"] for q in quizzes.data]

    if not quiz_ids:
        return min(len(article_ids), 6)

    attempts = supabase.table("quiz_attempts").select("quiz_id").eq(
        "user_id", user_id
    ).in_("quiz_id", quiz_ids).execute()

    completed_quiz_ids = {a["quiz_id"] for a in attempts.data}
    pending_count = sum(1 for q in quizzes.data if q["id"] not in completed_quiz_ids)
    return min(pending_count, 6)


async def calculate_gauge_gain(score: int, total: int) -> int:
    """Calculate gauge points earned from a quiz."""
    if score == total:
        return 15
    elif score >= total - 1:
        return 12
    elif score >= total - 2:
        return 9
    else:
        return 5
