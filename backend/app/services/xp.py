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
