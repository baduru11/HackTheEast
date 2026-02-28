from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.services.pipeline import ingest_finnhub, ingest_gnews, process_pending_articles, recover_stuck_articles
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


async def process_pending_job():
    """Proper async wrapper for processing pending articles."""
    await recover_stuck_articles()
    await process_pending_articles(batch_size=5)


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
        process_pending_job,
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
