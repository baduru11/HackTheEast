import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.scheduler.jobs import setup_scheduler
from app.routers import articles, quizzes, profile, favorites, leaderboard, notifications, sectors, market, friends, social, daily_quiz, predict, weekly_report


@asynccontextmanager
async def lifespan(app: FastAPI):
    tasks = setup_scheduler()
    yield
    # Cancel all background tasks on shutdown
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    print("Scheduler stopped")


app = FastAPI(title="FinaMeter API", version="0.1.0", lifespan=lifespan)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(articles.router)
app.include_router(quizzes.router)
app.include_router(profile.router)
app.include_router(favorites.router)
app.include_router(leaderboard.router)
app.include_router(notifications.router)
app.include_router(sectors.router)
app.include_router(market.router)
app.include_router(friends.router)
app.include_router(social.router)
app.include_router(daily_quiz.router)
app.include_router(predict.router)
app.include_router(weekly_report.router)


@app.get("/api/v1/health")
async def health():
    from app.scheduler.jobs import _tasks
    task_info = [
        {
            "name": t.get_name(),
            "done": t.done(),
            "cancelled": t.cancelled(),
        }
        for t in _tasks
    ]
    return {"status": "ok", "tasks": task_info}


@app.post("/api/v1/health/trigger-ingest")
async def trigger_ingest():
    """Manually trigger one ingestion cycle — for debugging."""
    from app.services.pipeline import ingest_rss, process_pending_articles
    await ingest_rss()
    await process_pending_articles(batch_size=5)
    return {"status": "ok", "triggered": True}


@app.post("/api/v1/health/trigger-weekly-report")
async def trigger_weekly_report():
    """Manually trigger weekly report generation — for debugging."""
    from app.services.weekly_report import generate_all_weekly_reports
    await generate_all_weekly_reports()
    return {"status": "ok", "triggered": True}
