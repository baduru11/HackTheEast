from fastapi import APIRouter, Depends, Query

from app.db import supabase as db
from app.dependencies import get_current_user, get_optional_user

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


@router.get("/global")
async def get_global_leaderboard(
    period: str = Query("all_time", pattern=r'^(all_time|weekly|monthly)$'),
):
    data = await db.get_global_leaderboard(period)
    return {"success": True, "data": data}


@router.get("/me")
async def get_my_rank(user_id: str = Depends(get_current_user)):
    rank = await db.get_user_rank(user_id)
    return {"success": True, "data": rank}


@router.get("/friends")
async def get_friends_leaderboard(
    period: str = Query("all_time", pattern=r'^(all_time|weekly|monthly)$'),
    user_id: str = Depends(get_current_user),
):
    friend_ids = await db.get_friend_ids(user_id)
    data = await db.get_friends_leaderboard(user_id, friend_ids, period)
    return {"success": True, "data": data}


@router.get("/sector/{sector_slug}")
async def get_sector_leaderboard(
    sector_slug: str,
    period: str = Query("all_time", pattern=r'^(all_time|weekly|monthly)$'),
):
    sector = await db.get_sector_by_slug(sector_slug)
    if not sector:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Sector not found"}}
    data = await db.get_sector_leaderboard(sector["id"], period)
    return {"success": True, "data": data}
