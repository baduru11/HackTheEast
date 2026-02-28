from fastapi import APIRouter, Depends, Query

from app.db import supabase as db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/friends", tags=["friends"])


@router.post("/request")
async def send_friend_request(
    body: dict,
    user_id: str = Depends(get_current_user),
):
    addressee_id = body.get("addressee_id")
    if not addressee_id:
        return {"success": False, "error": {"code": "MISSING_FIELD", "message": "addressee_id is required"}}

    if addressee_id == user_id:
        return {"success": False, "error": {"code": "INVALID", "message": "Cannot send friend request to yourself"}}

    # Check for existing friendship
    existing = await db.get_existing_friendship(user_id, addressee_id)
    if existing:
        if existing["status"] == "accepted":
            return {"success": False, "error": {"code": "ALREADY_FRIENDS", "message": "Already friends"}}
        if existing["status"] == "pending":
            return {"success": False, "error": {"code": "ALREADY_PENDING", "message": "Request already pending"}}
        if existing["status"] == "rejected":
            # Allow re-request after rejection by updating status
            await db.update_friendship_status(existing["id"], "pending")
            # Notify addressee
            addressee_profile = await db.get_profile(user_id)
            username = addressee_profile.get("username") or "Someone"
            await db.insert_notification(
                addressee_id, "friend_request",
                "New friend request",
                f"{username} sent you a friend request",
                "/friends",
            )
            return {"success": True, "data": {"friendship_id": existing["id"]}}

    friendship = await db.send_friend_request(user_id, addressee_id)

    # Notify addressee
    requester_profile = await db.get_profile(user_id)
    username = requester_profile.get("username") or "Someone"
    await db.insert_notification(
        addressee_id, "friend_request",
        "New friend request",
        f"{username} sent you a friend request",
        "/friends",
    )

    return {"success": True, "data": {"friendship_id": friendship["id"]}}


@router.post("/accept/{friendship_id}")
async def accept_friend_request(
    friendship_id: str,
    user_id: str = Depends(get_current_user),
):
    friendship = await db.get_friendship(friendship_id)
    if not friendship:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Friend request not found"}}
    if friendship["addressee_id"] != user_id:
        return {"success": False, "error": {"code": "FORBIDDEN", "message": "Not your request to accept"}}
    if friendship["status"] != "pending":
        return {"success": False, "error": {"code": "INVALID", "message": "Request is not pending"}}

    await db.update_friendship_status(friendship_id, "accepted")

    # Notify requester
    accepter_profile = await db.get_profile(user_id)
    username = accepter_profile.get("username") or "Someone"
    await db.insert_notification(
        friendship["requester_id"], "friend_accepted",
        "Friend request accepted",
        f"{username} accepted your friend request",
        "/friends",
    )

    return {"success": True}


@router.post("/reject/{friendship_id}")
async def reject_friend_request(
    friendship_id: str,
    user_id: str = Depends(get_current_user),
):
    friendship = await db.get_friendship(friendship_id)
    if not friendship:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Friend request not found"}}
    if friendship["addressee_id"] != user_id:
        return {"success": False, "error": {"code": "FORBIDDEN", "message": "Not your request to reject"}}
    if friendship["status"] != "pending":
        return {"success": False, "error": {"code": "INVALID", "message": "Request is not pending"}}

    await db.update_friendship_status(friendship_id, "rejected")
    return {"success": True}


@router.delete("/{friendship_id}")
async def unfriend(
    friendship_id: str,
    user_id: str = Depends(get_current_user),
):
    friendship = await db.get_friendship(friendship_id)
    if not friendship:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Friendship not found"}}
    if friendship["requester_id"] != user_id and friendship["addressee_id"] != user_id:
        return {"success": False, "error": {"code": "FORBIDDEN", "message": "Not your friendship"}}

    await db.delete_friendship(friendship_id)
    return {"success": True}


@router.get("")
async def get_friends(user_id: str = Depends(get_current_user)):
    raw = await db.get_accepted_friends(user_id)
    friends = []
    for row in raw:
        # Pick the friend's profile (not the current user's)
        if row["requester_id"] == user_id:
            profile = row.get("addressee") or {}
        else:
            profile = row.get("profiles") or {}
        friends.append({
            "friendship_id": row["id"],
            "id": profile.get("id"),
            "username": profile.get("username"),
            "display_name": profile.get("display_name"),
            "avatar_url": profile.get("avatar_url"),
            "total_xp": profile.get("total_xp", 0),
        })

    # Attach sector breakdown
    friend_ids = [f["id"] for f in friends if f["id"]]
    sectors_map = await db.get_users_sector_breakdown(friend_ids)
    for f in friends:
        f["sectors"] = sectors_map.get(f["id"], [])

    return {"success": True, "data": friends}


@router.get("/requests")
async def get_pending_requests(user_id: str = Depends(get_current_user)):
    raw = await db.get_pending_requests(user_id)
    requests = []
    for row in raw:
        profile = row.get("profiles") or {}
        requests.append({
            "friendship_id": row["id"],
            "user": {
                "id": profile.get("id"),
                "username": profile.get("username"),
                "display_name": profile.get("display_name"),
                "avatar_url": profile.get("avatar_url"),
                "total_xp": profile.get("total_xp", 0),
            },
            "created_at": row["created_at"],
        })
    return {"success": True, "data": requests}


@router.get("/search")
async def search_users(
    q: str = Query(..., min_length=1, max_length=50),
    user_id: str = Depends(get_current_user),
):
    results = await db.search_users(q, user_id)
    return {"success": True, "data": results}


@router.get("/invite-link")
async def get_invite_link(user_id: str = Depends(get_current_user)):
    profile = await db.get_profile(user_id)
    username = profile.get("username")
    if not username:
        return {"success": False, "error": {"code": "NO_USERNAME", "message": "Set a username first"}}
    return {"success": True, "data": {"link": f"/add/{username}", "username": username}}
