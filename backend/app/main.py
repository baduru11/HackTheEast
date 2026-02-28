import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.scheduler.jobs import setup_scheduler
from app.routers import articles, quizzes, profile, favorites, leaderboard, notifications, sectors, market


@asynccontextmanager
async def lifespan(app: FastAPI):
    sched = setup_scheduler()
    sched.start()
    print("Scheduler started")
    yield
    sched.shutdown()
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


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
