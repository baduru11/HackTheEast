from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.scheduler.jobs import setup_scheduler
from app.routers import articles, quizzes, profile, favorites, leaderboard, notifications, sectors


@asynccontextmanager
async def lifespan(app: FastAPI):
    sched = setup_scheduler()
    sched.start()
    print("Scheduler started")
    yield
    sched.shutdown()
    print("Scheduler stopped")


app = FastAPI(title="FinaMeter API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(articles.router)
app.include_router(quizzes.router)
app.include_router(profile.router)
app.include_router(favorites.router)
app.include_router(leaderboard.router)
app.include_router(notifications.router)
app.include_router(sectors.router)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}


@app.get("/api/v1/debug/token")
async def debug_token(authorization: str = None):
    """Temporary debug endpoint — remove after fixing auth."""
    from jose import jwt, JWTError
    from app.config import settings

    info = {
        "jwt_secret_len": len(settings.supabase_jwt_secret),
        "jwt_secret_prefix": settings.supabase_jwt_secret[:4] + "...",
        "has_auth_header": authorization is not None,
    }

    if authorization:
        token = authorization.replace("Bearer ", "")
        info["token_len"] = len(token)
        info["token_prefix"] = token[:20] + "..."
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
            info["decode_success"] = True
            info["sub"] = payload.get("sub")
            info["aud"] = payload.get("aud")
            info["exp"] = payload.get("exp")
        except JWTError as e:
            info["decode_success"] = False
            info["error"] = str(e)

    return info
