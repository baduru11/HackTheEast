from fastapi import Depends, HTTPException, Header
from supabase import create_client

from app.config import settings

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


async def get_current_user(authorization: str = Header(...)) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        res = supabase.auth.get_user(token)
        if not res or not res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return res.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(
    authorization: str | None = Header(None),
) -> str | None:
    if not authorization:
        return None
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None
