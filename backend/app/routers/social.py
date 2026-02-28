from fastapi import APIRouter, Depends, Query

from app.db import supabase as db
from app.dependencies import get_current_user
from app.models.social import ReactionCreate

router = APIRouter(prefix="/api/v1/feed", tags=["social"])


@router.get("/friends")
async def get_friends_feed(
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user),
):
    friend_ids = await db.get_friend_ids(user_id)
    activities = await db.get_friends_feed(user_id, friend_ids, cursor, limit)

    if not activities:
        return {"success": True, "data": [], "meta": {"next_cursor": None}}

    # Get reactions for these activities
    activity_ids = [a["id"] for a in activities]
    reactions = await db.get_activity_reactions(activity_ids)

    # Group reactions by activity
    reaction_map: dict[str, dict[str, int]] = {}
    my_reactions: dict[str, str] = {}
    for r in reactions:
        aid = r["activity_id"]
        if aid not in reaction_map:
            reaction_map[aid] = {}
        emoji = r["emoji"]
        reaction_map[aid][emoji] = reaction_map[aid].get(emoji, 0) + 1
        if r["user_id"] == user_id:
            my_reactions[aid] = emoji

    # Build response
    items = []
    for a in activities:
        profile = a.get("profiles") or {}
        r_counts = reaction_map.get(a["id"], {})
        items.append({
            "id": a["id"],
            "user_id": a["user_id"],
            "username": profile.get("username"),
            "display_name": profile.get("display_name"),
            "avatar_url": profile.get("avatar_url"),
            "activity_type": a["activity_type"],
            "metadata": a["metadata"],
            "created_at": a["created_at"],
            "reactions": [{"emoji": k, "count": v} for k, v in r_counts.items()],
            "my_reaction": my_reactions.get(a["id"]),
        })

    next_cursor = activities[-1]["created_at"] if len(activities) == limit else None
    return {"success": True, "data": items, "meta": {"next_cursor": next_cursor}}


@router.post("/{activity_id}/react")
async def add_reaction(
    activity_id: str,
    body: ReactionCreate,
    user_id: str = Depends(get_current_user),
):
    await db.upsert_reaction(activity_id, user_id, body.emoji)
    return {"success": True}


@router.delete("/{activity_id}/react")
async def remove_reaction(
    activity_id: str,
    user_id: str = Depends(get_current_user),
):
    await db.delete_reaction(activity_id, user_id)
    return {"success": True}
