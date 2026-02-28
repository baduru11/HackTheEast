import asyncio
from datetime import datetime, timedelta

from app.services.pipeline import (
    ingest_finnhub,
    ingest_gnews_regions,
    ingest_gnews_markets,
    ingest_rss,
    process_pending_articles,
    recover_stuck_articles,
)
from app.services.gauge import process_gauge_decay
from app.services.xp import award_passive_xp
from app.db.supabase import refresh_leaderboards
from app.services.predict import resolve_pending_predictions
from app.services.weekly_report import generate_all_weekly_reports

# Exported so health endpoint can inspect task state
_tasks: list[asyncio.Task] = []


def get_adaptive_interval_minutes() -> int:
    """Return polling interval based on market hours (ET)."""
    now = datetime.utcnow()
    et_hour = (now.hour - 5) % 24
    if 9 <= et_hour < 16:
        return 5
    elif 7 <= et_hour < 9 or 16 <= et_hour < 20:
        return 10
    else:
        return 30


async def _run_periodically(name: str, coro_func, interval_seconds: float, initial_delay: float = 10.0):
    """Run a coroutine function on a fixed interval. Logs errors but never stops."""
    await asyncio.sleep(initial_delay)
    while True:
        try:
            print(f"[scheduler] running: {name}")
            await coro_func()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"[scheduler] '{name}' error: {e}")
        await asyncio.sleep(interval_seconds)


async def _finnhub_adaptive_job():
    await ingest_finnhub()
    await process_pending_articles(batch_size=15)


async def _process_pending_job():
    await recover_stuck_articles()
    await process_pending_articles(batch_size=15)


async def _resolve_predictions_daily():
    """Fire at 21:05 UTC on weekdays (market close ET)."""
    while True:
        now = datetime.utcnow()
        next_run = now.replace(hour=21, minute=5, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        while next_run.weekday() >= 5:   # skip Saturday (5) and Sunday (6)
            next_run += timedelta(days=1)
        await asyncio.sleep((next_run - now).total_seconds())
        try:
            print("[scheduler] running: resolve_predictions")
            await resolve_pending_predictions()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"[scheduler] 'resolve_predictions' error: {e}")


async def _cleanup_notifications_daily():
    """Fire daily at 03:00 UTC."""
    while True:
        now = datetime.utcnow()
        next_run = now.replace(hour=3, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        await asyncio.sleep((next_run - now).total_seconds())
        try:
            print("[scheduler] running: cleanup_notifications")
            from app.dependencies import supabase
            supabase.table("notifications").delete().lt(
                "expires_at", datetime.utcnow().isoformat()
            ).execute()
            print("[scheduler] cleaned up expired notifications")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"[scheduler] 'cleanup_notifications' error: {e}")


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


def setup_scheduler() -> list[asyncio.Task]:
    """
    Create all background asyncio tasks.
    Must be called from inside a running event loop (e.g. FastAPI lifespan).
    Returns the list of tasks so the caller can cancel them on shutdown.
    """
    global _tasks
    _tasks = [
        # Process pending articles every 2 min (runs 10 s after startup)
        asyncio.create_task(
            _run_periodically("process_pending", _process_pending_job, 2 * 60, initial_delay=10),
            name="process_pending",
        ),
        # Refresh leaderboard every 5 min
        asyncio.create_task(
            _run_periodically("refresh_lb", refresh_leaderboards, 5 * 60, initial_delay=15),
            name="refresh_lb",
        ),
        # Gauge decay every 30 min
        asyncio.create_task(
            _run_periodically("gauge_decay", process_gauge_decay, 30 * 60, initial_delay=20),
            name="gauge_decay",
        ),
        # Passive XP every 10 min
        asyncio.create_task(
            _run_periodically("passive_xp", award_passive_xp, 10 * 60, initial_delay=25),
            name="passive_xp",
        ),
        # Finnhub adaptive poll every 15 min
        asyncio.create_task(
            _run_periodically("finnhub_poll", _finnhub_adaptive_job, 15 * 60, initial_delay=30),
            name="finnhub_poll",
        ),
        # RSS feeds every 30 min
        asyncio.create_task(
            _run_periodically("rss_poll", ingest_rss, 30 * 60, initial_delay=45),
            name="rss_poll",
        ),
        # GNews regions every 4 h (starts 60 s after boot)
        asyncio.create_task(
            _run_periodically("gnews_regions", ingest_gnews_regions, 4 * 3600, initial_delay=60),
            name="gnews_regions",
        ),
        # GNews markets every 4 h, offset +2 h so they don't overlap
        asyncio.create_task(
            _run_periodically("gnews_markets", ingest_gnews_markets, 4 * 3600, initial_delay=2 * 3600),
            name="gnews_markets",
        ),
        # Stock prediction resolution at market close weekdays
        asyncio.create_task(_resolve_predictions_daily(), name="resolve_predictions"),
        # Notification cleanup daily at 3 AM UTC
        asyncio.create_task(_cleanup_notifications_daily(), name="cleanup_notifications"),
        # Weekly report generation every Monday 6 AM UTC
        asyncio.create_task(_generate_weekly_reports(), name="weekly_reports"),
    ]
    print(f"[scheduler] started {len(_tasks)} background tasks")
    return _tasks
