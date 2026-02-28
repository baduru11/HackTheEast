from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError
from supabase import create_client

from app.config import settings

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


async def get_current_user(authorization: str = Header(...)) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
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
