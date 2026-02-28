from fastapi import APIRouter, Depends

from app.db import supabase as db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/favorites", tags=["favorites"])


@router.get("")
async def get_favorites(user_id: str = Depends(get_current_user)):
    favorites = await db.get_user_favorites(user_id)
    return {"success": True, "data": favorites}


@router.post("")
async def add_favorite(
    body: dict,
    user_id: str = Depends(get_current_user),
):
    sector_id = body.get("sector_id")
    if not sector_id:
        return {"success": False, "error": {"code": "MISSING_FIELD", "message": "sector_id required"}}
    await db.add_favorite(user_id, sector_id)
    return {"success": True, "data": {"sector_id": sector_id, "gauge_score": 50}}


@router.delete("/{sector_id}")
async def remove_favorite(
    sector_id: int,
    user_id: str = Depends(get_current_user),
):
    await db.remove_favorite(user_id, sector_id)
    return {"success": True}


@router.get("/pending")
async def get_pending_quizzes(user_id: str = Depends(get_current_user)):
    favorites = await db.get_user_favorites(user_id)
    # For each favorite sector, count pending quizzes
    # This is a simplified version — full implementation would query unquizzed articles per sector
    return {"success": True, "data": favorites}
