from fastapi import APIRouter, Depends, Query

from app.db import supabase as db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user),
):
    data, total = await db.get_notifications(user_id, page, limit)
    return {
        "success": True,
        "data": data,
        "meta": {"page": page, "limit": limit, "total": total},
    }


@router.patch("/{notification_id}")
async def mark_read(
    notification_id: int,
    user_id: str = Depends(get_current_user),
):
    await db.mark_notification_read(notification_id, user_id)
    return {"success": True}


@router.post("/read-all")
async def mark_all_read(user_id: str = Depends(get_current_user)):
    await db.mark_all_notifications_read(user_id)
    return {"success": True}


@router.delete("/all")
async def delete_all(user_id: str = Depends(get_current_user)):
    await db.delete_all_notifications(user_id)
    return {"success": True}
