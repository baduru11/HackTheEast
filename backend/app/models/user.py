from pydantic import BaseModel
from datetime import datetime


class ProfileOut(BaseModel):
    id: str
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    total_xp: int
    created_at: datetime


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    username: str | None = None
    avatar_url: str | None = None


class DashboardOut(BaseModel):
    profile: ProfileOut
    streak_days: int
    global_rank: int | None = None
    favorites: list["FavoriteOut"]
    recent_activity: list["ActivityOut"]


class FavoriteOut(BaseModel):
    sector_id: int
    sector_name: str
    sector_slug: str
    gauge_score: int
    pending_quizzes: int


class ActivityOut(BaseModel):
    description: str
    xp_earned: int
    completed_at: datetime


class LeaderboardEntry(BaseModel):
    user_id: str
    username: str | None = None
    avatar_url: str | None = None
    xp: int
    rank: int


class SectorOut(BaseModel):
    id: int
    name: str
    category: str
    slug: str
