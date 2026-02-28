from fastapi import APIRouter

from app.db import supabase as db

router = APIRouter(prefix="/api/v1/sectors", tags=["sectors"])


@router.get("")
async def get_sectors():
    data = await db.get_all_sectors()
    return {"success": True, "data": data}
