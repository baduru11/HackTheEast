from app.db import supabase as db


async def record_quiz_completed(user_id: str, article_id: int, article_title: str, score: int, max_score: int):
    """Record a quiz completion activity for the social feed."""
    await db.insert_activity(user_id, "quiz_completed", {
        "article_id": article_id,
        "article_title": article_title,
        "score": score,
        "max_score": max_score,
    })


async def record_gauge_milestone(user_id: str, sector_name: str, gauge_score: int, threshold: int):
    """Record a gauge milestone (80, 90, 100) if not recently recorded."""
    existing = await db.has_recent_activity(
        user_id, "gauge_milestone", "threshold", str(threshold), hours=24,
    )
    if not existing:
        await db.insert_activity(user_id, "gauge_milestone", {
            "sector_name": sector_name,
            "gauge_score": gauge_score,
            "threshold": threshold,
        })


async def record_streak_milestone(user_id: str, streak_days: int):
    """Record a streak milestone (7, 14, 30) if not recently recorded."""
    existing = await db.has_recent_activity(
        user_id, "streak_milestone", "streak_days", str(streak_days), hours=168,
    )
    if not existing:
        await db.insert_activity(user_id, "streak_milestone", {
            "streak_days": streak_days,
        })
