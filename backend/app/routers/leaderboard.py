from fastapi import APIRouter, Depends

from app.db import supabase as db
from app.dependencies import get_current_user, get_optional_user

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


@router.get("")
async def get_global_leaderboard():
    data = await db.get_global_leaderboard()
    return {"success": True, "data": data}


@router.get("/me")
async def get_my_rank(user_id: str = Depends(get_current_user)):
    rank = await db.get_user_rank(user_id)
    return {"success": True, "data": rank}


@router.get("/{sector_slug}")
async def get_sector_leaderboard(sector_slug: str):
    sector = await db.get_sector_by_slug(sector_slug)
    if not sector:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Sector not found"}}
    data = await db.get_sector_leaderboard(sector["id"])
    return {"success": True, "data": data}
