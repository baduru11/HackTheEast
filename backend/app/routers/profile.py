from fastapi import APIRouter, Depends

from app.db import supabase as db
from app.dependencies import get_current_user
from app.models.user import ProfileUpdate

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


@router.get("")
async def get_dashboard(user_id: str = Depends(get_current_user)):
    profile = await db.get_profile(user_id)
    streak = await db.get_streak_days(user_id)
    rank = await db.get_user_rank(user_id)
    favorites = await db.get_user_favorites(user_id)

    return {
        "success": True,
        "data": {
            "profile": profile,
            "streak_days": streak,
            "global_rank": rank["rank"] if rank else None,
            "favorites": favorites,
        },
    }


@router.put("")
async def update_profile(
    data: ProfileUpdate,
    user_id: str = Depends(get_current_user),
):
    update_data = data.model_dump(exclude_none=True)
    if update_data:
        await db.update_profile(user_id, update_data)
    profile = await db.get_profile(user_id)
    return {"success": True, "data": profile}
