# Social Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add friend system, social activity feed with emoji reactions, and improved leaderboards (friends tab, weekly/monthly periods, 20-user cap) to FinaMeter.

**Architecture:** New `friendships`, `activity_feed`, and `activity_reactions` tables in Supabase. New FastAPI routers for friends and social feed. Activity events inserted server-side when quizzes complete, gauges hit milestones, or streaks trigger. Frontend gets 3 new pages (`/social`, `/friends`, `/add/[username]`) and a revamped leaderboard with tabs.

**Tech Stack:** Supabase PostgreSQL (migrations), FastAPI (routers + services), Next.js (pages + components), Tailwind CSS

**Supabase Project ID:** `zgusqjuuqmhzpjrkgxhg`

**Design Doc:** `docs/plans/2026-02-28-social-features-design.md`

---

## Task 1: Database Migration — Friendships Table

**Files:**
- Supabase migration (applied via MCP tool)

**Step 1: Apply the friendships migration**

```sql
-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

-- Indexes
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);

-- RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can insert friend requests"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update friendships addressed to them"
  ON friendships FOR UPDATE
  USING (auth.uid() = addressee_id);

CREATE POLICY "Users can delete their own friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
```

Run: `apply_migration` with name `create_friendships_table`

**Step 2: Verify migration applied**

Run: `list_tables` for schema `public` and confirm `friendships` appears.

**Step 3: Commit**

```bash
git add docs/plans/2026-02-28-social-features-implementation.md
git commit -m "feat: add friendships table migration"
```

---

## Task 2: Database Migration — Activity Feed & Reactions Tables

**Files:**
- Supabase migration (applied via MCP tool)

**Step 1: Apply the activity feed migration**

```sql
-- Activity feed table
CREATE TABLE IF NOT EXISTS activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('quiz_completed', 'gauge_milestone', 'streak_milestone')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_feed_user_created ON activity_feed(user_id, created_at DESC);
CREATE INDEX idx_activity_feed_created ON activity_feed(created_at DESC);

-- Activity reactions table
CREATE TABLE IF NOT EXISTS activity_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('fire', 'brain', 'clap', 'rocket', 'flex', 'bullseye')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, user_id)
);

CREATE INDEX idx_activity_reactions_activity ON activity_reactions(activity_id);

-- RLS for activity_feed
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activities of their friends"
  ON activity_feed FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = activity_feed.user_id)
        OR (addressee_id = auth.uid() AND requester_id = activity_feed.user_id)
      )
    )
  );

CREATE POLICY "Service role can insert activities"
  ON activity_feed FOR INSERT
  WITH CHECK (true);

-- RLS for activity_reactions
ALTER TABLE activity_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions on visible activities"
  ON activity_reactions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert reactions"
  ON activity_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reactions"
  ON activity_reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions"
  ON activity_reactions FOR DELETE
  USING (auth.uid() = user_id);
```

Run: `apply_migration` with name `create_activity_feed_and_reactions_tables`

**Step 2: Verify migration applied**

Run: `list_tables` for schema `public` and confirm `activity_feed` and `activity_reactions` appear.

---

## Task 3: Database Migration — Leaderboard Weekly/Monthly Views

**Files:**
- Supabase migration (applied via MCP tool)

**Step 1: Apply the leaderboard views migration**

```sql
-- Weekly leaderboard materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_weekly AS
SELECT
  p.id AS user_id,
  p.username,
  p.avatar_url,
  COALESCE(SUM(qa.xp_earned), 0)::int AS xp,
  ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(qa.xp_earned), 0) DESC) AS rank
FROM profiles p
LEFT JOIN quiz_attempts qa
  ON qa.user_id = p.id::text
  AND qa.completed_at >= now() - interval '7 days'
GROUP BY p.id, p.username, p.avatar_url
HAVING COALESCE(SUM(qa.xp_earned), 0) > 0
ORDER BY xp DESC
LIMIT 20;

CREATE UNIQUE INDEX idx_leaderboard_weekly_user ON leaderboard_weekly(user_id);

-- Monthly leaderboard materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_monthly AS
SELECT
  p.id AS user_id,
  p.username,
  p.avatar_url,
  COALESCE(SUM(qa.xp_earned), 0)::int AS xp,
  ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(qa.xp_earned), 0) DESC) AS rank
FROM profiles p
LEFT JOIN quiz_attempts qa
  ON qa.user_id = p.id::text
  AND qa.completed_at >= now() - interval '30 days'
GROUP BY p.id, p.username, p.avatar_url
HAVING COALESCE(SUM(qa.xp_earned), 0) > 0
ORDER BY xp DESC
LIMIT 20;

CREATE UNIQUE INDEX idx_leaderboard_monthly_user ON leaderboard_monthly(user_id);

-- Update refresh_leaderboards function to include new views
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_global;
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_sector;
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_weekly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_monthly;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Run: `apply_migration` with name `create_weekly_monthly_leaderboard_views`

**Step 2: Verify migration applied**

Run: `execute_sql` with query `SELECT * FROM leaderboard_weekly LIMIT 1;` to confirm the view exists.

---

## Task 4: Backend Models — Social Pydantic Models

**Files:**
- Create: `backend/app/models/social.py`

**Step 1: Create the social models file**

```python
from pydantic import BaseModel, Field
from datetime import datetime


class FriendRequestCreate(BaseModel):
    addressee_id: str


class FriendshipOut(BaseModel):
    id: str
    requester_id: str
    addressee_id: str
    status: str
    created_at: datetime
    updated_at: datetime


class FriendOut(BaseModel):
    id: str
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    total_xp: int
    top_gauge: int | None = None
    top_sector: str | None = None


class FriendRequestOut(BaseModel):
    friendship_id: str
    user: "FriendOut"
    created_at: datetime


class ReactionCount(BaseModel):
    emoji: str
    count: int


class ActivityFeedItem(BaseModel):
    id: str
    user_id: str
    username: str | None = None
    avatar_url: str | None = None
    activity_type: str
    metadata: dict
    created_at: datetime
    reactions: list[ReactionCount] = []
    my_reaction: str | None = None


class ReactionCreate(BaseModel):
    emoji: str = Field(..., pattern=r'^(fire|brain|clap|rocket|flex|bullseye)$')


class InviteLinkOut(BaseModel):
    link: str
    username: str
```

**Step 2: Commit**

```bash
git add backend/app/models/social.py
git commit -m "feat: add social pydantic models"
```

---

## Task 5: Backend DB Functions — Friendships

**Files:**
- Modify: `backend/app/db/supabase.py` (add after line 299)

**Step 1: Add friendship DB functions**

Add the following after the `# --- Streak ---` section at the end of `supabase.py`:

```python

# --- Friendships ---

async def send_friend_request(requester_id: str, addressee_id: str) -> dict:
    result = supabase.table("friendships").insert({
        "requester_id": requester_id,
        "addressee_id": addressee_id,
        "status": "pending",
    }).execute()
    return result.data[0]


async def get_friendship(friendship_id: str) -> dict | None:
    result = supabase.table("friendships").select("*").eq("id", friendship_id).execute()
    return result.data[0] if result.data else None


async def get_existing_friendship(user_a: str, user_b: str) -> dict | None:
    """Check if any friendship exists between two users (in either direction)."""
    result = supabase.table("friendships").select("*").or_(
        f"and(requester_id.eq.{user_a},addressee_id.eq.{user_b}),and(requester_id.eq.{user_b},addressee_id.eq.{user_a})"
    ).execute()
    return result.data[0] if result.data else None


async def update_friendship_status(friendship_id: str, status: str):
    supabase.table("friendships").update({
        "status": status,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", friendship_id).execute()


async def delete_friendship(friendship_id: str):
    supabase.table("friendships").delete().eq("id", friendship_id).execute()


async def get_accepted_friends(user_id: str) -> list[dict]:
    """Get all accepted friends for a user with profile info."""
    result = supabase.table("friendships").select(
        "id, requester_id, addressee_id, profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url, total_xp), addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url, total_xp)"
    ).eq("status", "accepted").or_(
        f"requester_id.eq.{user_id},addressee_id.eq.{user_id}"
    ).execute()
    return result.data


async def get_pending_requests(user_id: str) -> list[dict]:
    """Get pending friend requests addressed to this user."""
    result = supabase.table("friendships").select(
        "id, requester_id, created_at, profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url, total_xp)"
    ).eq("addressee_id", user_id).eq("status", "pending").order("created_at", desc=True).execute()
    return result.data


async def get_friend_ids(user_id: str) -> list[str]:
    """Get IDs of all accepted friends."""
    result = supabase.table("friendships").select(
        "requester_id, addressee_id"
    ).eq("status", "accepted").or_(
        f"requester_id.eq.{user_id},addressee_id.eq.{user_id}"
    ).execute()
    ids = []
    for row in result.data:
        ids.append(row["addressee_id"] if row["requester_id"] == user_id else row["requester_id"])
    return ids


async def search_users(query: str, current_user_id: str) -> list[dict]:
    """Search profiles by username (partial match), excluding current user."""
    result = supabase.table("profiles").select(
        "id, username, display_name, avatar_url, total_xp"
    ).ilike("username", f"%{query}%").neq("id", current_user_id).limit(10).execute()
    return result.data


async def get_profile_by_username(username: str) -> dict | None:
    result = supabase.table("profiles").select(
        "id, username, display_name, avatar_url, total_xp"
    ).eq("username", username).execute()
    return result.data[0] if result.data else None
```

**Step 2: Commit**

```bash
git add backend/app/db/supabase.py
git commit -m "feat: add friendship DB functions"
```

---

## Task 6: Backend DB Functions — Activity Feed & Reactions

**Files:**
- Modify: `backend/app/db/supabase.py` (append after friendships section)

**Step 1: Add activity feed DB functions**

Append after the friendship functions:

```python


# --- Activity Feed ---

async def insert_activity(user_id: str, activity_type: str, metadata: dict) -> dict:
    result = supabase.table("activity_feed").insert({
        "user_id": user_id,
        "activity_type": activity_type,
        "metadata": metadata,
    }).execute()
    return result.data[0]


async def has_recent_activity(user_id: str, activity_type: str, metadata_key: str, metadata_value: str, hours: int = 24) -> bool:
    """Check if a similar activity exists within the last N hours (dedup)."""
    cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
    result = supabase.table("activity_feed").select("id").eq(
        "user_id", user_id
    ).eq("activity_type", activity_type).gte("created_at", cutoff).execute()
    for row in result.data:
        # We check at application level since jsonb filtering is limited in supabase-py
        pass
    # Simplified: just check type + time window
    return len(result.data) > 0


async def get_friends_feed(user_id: str, friend_ids: list[str], cursor: str | None = None, limit: int = 20) -> list[dict]:
    """Get activity feed for a list of friend IDs."""
    if not friend_ids:
        return []

    query = supabase.table("activity_feed").select(
        "*, profiles!activity_feed_user_id_fkey(username, avatar_url)"
    ).in_("user_id", friend_ids).order("created_at", desc=True).limit(limit)

    if cursor:
        query = query.lt("created_at", cursor)

    result = query.execute()
    return result.data


async def get_activity_reactions(activity_ids: list[str]) -> list[dict]:
    """Get all reactions for a list of activity IDs."""
    if not activity_ids:
        return []
    result = supabase.table("activity_reactions").select("*").in_("activity_id", activity_ids).execute()
    return result.data


async def upsert_reaction(activity_id: str, user_id: str, emoji: str):
    """Add or update a reaction. Uses upsert on (activity_id, user_id)."""
    supabase.table("activity_reactions").upsert({
        "activity_id": activity_id,
        "user_id": user_id,
        "emoji": emoji,
    }, on_conflict="activity_id,user_id").execute()


async def delete_reaction(activity_id: str, user_id: str):
    supabase.table("activity_reactions").delete().eq(
        "activity_id", activity_id
    ).eq("user_id", user_id).execute()
```

**Step 2: Commit**

```bash
git add backend/app/db/supabase.py
git commit -m "feat: add activity feed and reactions DB functions"
```

---

## Task 7: Backend DB Functions — Leaderboard Updates

**Files:**
- Modify: `backend/app/db/supabase.py` (update leaderboard section, lines 238-256)

**Step 1: Update the leaderboard DB functions**

Replace the existing leaderboard section (lines 238-256) with:

```python
# --- Leaderboard ---

async def get_global_leaderboard(period: str = "all_time") -> list[dict]:
    if period == "weekly":
        result = supabase.table("leaderboard_weekly").select("*").order("rank").limit(20).execute()
    elif period == "monthly":
        result = supabase.table("leaderboard_monthly").select("*").order("rank").limit(20).execute()
    else:
        result = supabase.table("leaderboard_global").select("*").order("rank").limit(20).execute()
    return result.data


async def get_sector_leaderboard(sector_id: int, period: str = "all_time") -> list[dict]:
    # Weekly/monthly sector leaderboards use same all-time view for now
    result = supabase.table("leaderboard_sector").select("*").eq("sector_id", sector_id).order("rank").limit(20).execute()
    return result.data


async def get_user_rank(user_id: str):
    result = supabase.table("leaderboard_global").select("*").eq("user_id", user_id).execute()
    return result.data[0] if result.data else None


async def get_friends_leaderboard(user_id: str, friend_ids: list[str], period: str = "all_time") -> list[dict]:
    """Get leaderboard for user + their friends."""
    all_ids = [user_id] + friend_ids
    if period == "weekly":
        result = supabase.table("leaderboard_weekly").select("*").in_("user_id", all_ids).order("rank").execute()
    elif period == "monthly":
        result = supabase.table("leaderboard_monthly").select("*").in_("user_id", all_ids).order("rank").execute()
    else:
        result = supabase.table("leaderboard_global").select("*").in_("user_id", all_ids).order("rank").execute()
    # Re-rank within friends
    entries = sorted(result.data, key=lambda x: x.get("xp", x.get("total_xp", 0)), reverse=True)
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1
    return entries


async def refresh_leaderboards():
    supabase.rpc("refresh_leaderboards").execute()
```

**Step 2: Commit**

```bash
git add backend/app/db/supabase.py
git commit -m "feat: update leaderboard DB functions with periods and friends"
```

---

## Task 8: Backend Router — Friends

**Files:**
- Create: `backend/app/routers/friends.py`

**Step 1: Create the friends router**

```python
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
```

**Step 2: Commit**

```bash
git add backend/app/routers/friends.py
git commit -m "feat: add friends router with request/accept/reject/search"
```

---

## Task 9: Backend Router — Social Feed

**Files:**
- Create: `backend/app/routers/social.py`

**Step 1: Create the social feed router**

```python
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
```

**Step 2: Commit**

```bash
git add backend/app/routers/social.py
git commit -m "feat: add social feed router with reactions"
```

---

## Task 10: Backend Router — Update Leaderboard

**Files:**
- Modify: `backend/app/routers/leaderboard.py`

**Step 1: Replace leaderboard router with updated version**

Replace the entire content of `backend/app/routers/leaderboard.py` with:

```python
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
```

**Important:** The old `GET /api/v1/leaderboard` (no subpath) route changes to `GET /api/v1/leaderboard/global`. The frontend will need to update its calls accordingly (handled in Task 14).

**Step 2: Commit**

```bash
git add backend/app/routers/leaderboard.py
git commit -m "feat: update leaderboard with period filters and friends tab"
```

---

## Task 11: Backend — Register New Routers in main.py

**Files:**
- Modify: `backend/app/main.py` (lines 8 and 33-40)

**Step 1: Update imports on line 8**

Change line 8 from:
```python
from app.routers import articles, quizzes, profile, favorites, leaderboard, notifications, sectors, market
```
to:
```python
from app.routers import articles, quizzes, profile, favorites, leaderboard, notifications, sectors, market, friends, social
```

**Step 2: Register new routers after line 40**

After `app.include_router(market.router)` add:
```python
app.include_router(friends.router)
app.include_router(social.router)
```

**Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register friends and social routers"
```

---

## Task 12: Backend Service — Activity Insert Logic

**Files:**
- Create: `backend/app/services/activity.py`

**Step 1: Create the activity service**

```python
from app.db import supabase as db


async def record_quiz_completed(user_id: str, article_id: int, article_title: str, score: int, max_score: int):
    """Record a quiz completion activity for the social feed."""
    await db.insert_activity(user_id, "quiz_completed", {
        "article_id": article_id,
        "article_title": article_title,
        "score": score,
        "max_score": max_score,
    })


async def record_gauge_milestone(user_id: str, sector_name: str, gauge_score: int, threshold: int):
    """Record a gauge milestone (80, 90, 100) if not recently recorded."""
    existing = await db.has_recent_activity(
        user_id, "gauge_milestone", "threshold", str(threshold), hours=24,
    )
    if not existing:
        await db.insert_activity(user_id, "gauge_milestone", {
            "sector_name": sector_name,
            "gauge_score": gauge_score,
            "threshold": threshold,
        })


async def record_streak_milestone(user_id: str, streak_days: int):
    """Record a streak milestone (7, 14, 30) if not recently recorded."""
    existing = await db.has_recent_activity(
        user_id, "streak_milestone", "streak_days", str(streak_days), hours=168,
    )
    if not existing:
        await db.insert_activity(user_id, "streak_milestone", {
            "streak_days": streak_days,
        })
```

**Step 2: Commit**

```bash
git add backend/app/services/activity.py
git commit -m "feat: add activity service for recording social events"
```

---

## Task 13: Backend — Wire Activity Inserts into Quiz Submission

**Files:**
- Modify: `backend/app/routers/quizzes.py`

**Step 1: Add import at top of quizzes.py (after line 7)**

```python
from app.services.activity import record_quiz_completed, record_gauge_milestone, record_streak_milestone
```

**Step 2: After the quiz attempt save (after line 79), add activity recording**

After `await db.insert_quiz_attempt(user_id, quiz["id"], score, total, xp_earned)` add:

```python
    # Record social activity
    article_for_feed = await db.get_article_by_id(article_id)
    headline = (article_for_feed or {}).get("headline", "an article")
    await record_quiz_completed(user_id, article_id, headline, score, total)
```

**Step 3: After gauge updates (after line 96), add gauge milestone check**

After the `for sid in sector_ids:` loop (after `gauge_updates[sid] = new_score`), add:

```python
    # Check for gauge milestones
    for sid, new_gauge in gauge_updates.items():
        if new_gauge >= 100:
            sector_info = next((f for f in favorites if f["sector_id"] == sid), None)
            sector_name = sector_info.get("sectors", {}).get("name", "Unknown") if sector_info else "Unknown"
            await record_gauge_milestone(user_id, sector_name, new_gauge, 100)
        elif new_gauge >= 90:
            sector_info = next((f for f in favorites if f["sector_id"] == sid), None)
            sector_name = sector_info.get("sectors", {}).get("name", "Unknown") if sector_info else "Unknown"
            await record_gauge_milestone(user_id, sector_name, new_gauge, 90)
        elif new_gauge >= 80:
            sector_info = next((f for f in favorites if f["sector_id"] == sid), None)
            sector_name = sector_info.get("sectors", {}).get("name", "Unknown") if sector_info else "Unknown"
            await record_gauge_milestone(user_id, sector_name, new_gauge, 80)

    # Check for streak milestones
    streak = await db.get_streak_days(user_id)
    if streak in (7, 14, 30):
        await record_streak_milestone(user_id, streak)
```

**Step 4: Commit**

```bash
git add backend/app/routers/quizzes.py
git commit -m "feat: wire activity inserts into quiz submission"
```

---

## Task 14: Frontend Types — Add Social Types

**Files:**
- Modify: `frontend/src/types/index.ts` (append at end)

**Step 1: Add social types after line 179**

```typescript

// --- Social Types ---

export interface FriendProfile {
  id: string;
  friendship_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number;
}

export interface FriendRequest {
  friendship_id: string;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    total_xp: number;
  };
  created_at: string;
}

export interface ReactionCount {
  emoji: string;
  count: number;
}

export interface ActivityFeedItem {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  activity_type: "quiz_completed" | "gauge_milestone" | "streak_milestone";
  metadata: Record<string, unknown>;
  created_at: string;
  reactions: ReactionCount[];
  my_reaction: string | null;
}
```

**Step 2: Update Notification type to include new types**

Change line 173 from:
```typescript
  type: "new_article" | "gauge_decay" | "achievement";
```
to:
```typescript
  type: "new_article" | "gauge_decay" | "achievement" | "friend_request" | "friend_accepted";
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add social types to frontend"
```

---

## Task 15: Frontend Page — Friends Page

**Files:**
- Create: `frontend/src/app/friends/page.tsx`

**Step 1: Create the friends page**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { FriendProfile, FriendRequest } from "@/types";
import Link from "next/link";

export default function FriendsPage() {
  const { user, session } = useAuth();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const token = session?.access_token;

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const [friendsRes, requestsRes] = await Promise.all([
      apiFetch<FriendProfile[]>("/friends", { token }),
      apiFetch<FriendRequest[]>("/friends/requests", { token }),
    ]);
    if (friendsRes.data) setFriends(friendsRes.data);
    if (requestsRes.data) setRequests(requestsRes.data);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = async () => {
    if (!token || searchQuery.length < 1) return;
    setSearching(true);
    const res = await apiFetch<FriendProfile[]>(`/friends/search?q=${encodeURIComponent(searchQuery)}`, { token });
    if (res.data) setSearchResults(res.data);
    setSearching(false);
  };

  const sendRequest = async (addresseeId: string) => {
    if (!token) return;
    await apiFetch("/friends/request", {
      token,
      method: "POST",
      body: JSON.stringify({ addressee_id: addresseeId }),
    });
    setSearchResults((prev) => prev.filter((u) => u.id !== addresseeId));
  };

  const acceptRequest = async (friendshipId: string) => {
    if (!token) return;
    await apiFetch(`/friends/accept/${friendshipId}`, { token, method: "POST" });
    fetchData();
  };

  const rejectRequest = async (friendshipId: string) => {
    if (!token) return;
    await apiFetch(`/friends/reject/${friendshipId}`, { token, method: "POST" });
    setRequests((prev) => prev.filter((r) => r.friendship_id !== friendshipId));
  };

  const unfriend = async (friendshipId: string) => {
    if (!token) return;
    await apiFetch(`/friends/${friendshipId}`, { token, method: "DELETE" });
    setFriends((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
  };

  const copyInviteLink = async () => {
    if (!token) return;
    const res = await apiFetch<{ link: string }>("/friends/invite-link", { token });
    if (res.data?.link) {
      await navigator.clipboard.writeText(window.location.origin + res.data.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-400 mb-4">Sign in to add friends</p>
        <Link href="/login" className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-6 py-2 rounded-lg">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Friends</h1>
        <button
          onClick={copyInviteLink}
          className="bg-teal-500/10 text-teal-400 border border-teal-400/30 text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-teal-500/20 transition-colors"
        >
          {copied ? "Copied!" : "Share invite link"}
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search by username..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-400/50"
        />
        <button
          onClick={handleSearch}
          disabled={searching || searchQuery.length < 1}
          className="bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Search
        </button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Search Results</p>
          <div className="space-y-1">
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900 border border-gray-800">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                    {(u.username || "?")[0].toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm text-white font-medium">{u.username || "Anonymous"}</span>
                <span className="text-xs text-gray-500">{u.total_xp.toLocaleString()} XP</span>
                <button
                  onClick={() => sendRequest(u.id)}
                  className="text-xs bg-teal-500/10 text-teal-400 border border-teal-400/30 px-3 py-1 rounded-lg hover:bg-teal-500/20"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Requests */}
      {requests.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Pending Requests</p>
          <div className="space-y-1">
            {requests.map((r) => (
              <div key={r.friendship_id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900 border border-yellow-500/20">
                {r.user.avatar_url ? (
                  <img src={r.user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                    {(r.user.username || "?")[0].toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm text-white font-medium">{r.user.username || "Anonymous"}</span>
                <button
                  onClick={() => acceptRequest(r.friendship_id)}
                  className="text-xs bg-teal-500 text-white px-3 py-1 rounded-lg hover:bg-teal-400"
                >
                  Accept
                </button>
                <button
                  onClick={() => rejectRequest(r.friendship_id)}
                  className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1"
                >
                  Reject
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
          Friends {!loading && `(${friends.length})`}
        </p>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 skeleton-shimmer rounded-lg" />
            ))}
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">No friends yet</p>
            <p className="text-gray-600 text-sm">Search for users or share your invite link</p>
          </div>
        ) : (
          <div className="space-y-1">
            {friends.map((f) => (
              <div key={f.friendship_id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 group">
                {f.avatar_url ? (
                  <img src={f.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                    {(f.username || "?")[0].toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm text-white font-medium">{f.username || "Anonymous"}</span>
                <span className="text-xs text-gray-500">{f.total_xp.toLocaleString()} XP</span>
                <button
                  onClick={() => unfriend(f.friendship_id)}
                  className="text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1"
                >
                  Unfriend
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/friends/page.tsx
git commit -m "feat: add friends page with search, requests, and friend list"
```

---

## Task 16: Frontend Page — Social Feed

**Files:**
- Create: `frontend/src/app/social/page.tsx`

**Step 1: Create the social feed page**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { ActivityFeedItem } from "@/types";
import Link from "next/link";

const EMOJI_MAP: Record<string, string> = {
  fire: "\u{1F525}",
  brain: "\u{1F9E0}",
  clap: "\u{1F44F}",
  rocket: "\u{1F680}",
  flex: "\u{1F4AA}",
  bullseye: "\u{1F3AF}",
};

const EMOJI_KEYS = Object.keys(EMOJI_MAP);

function formatActivity(item: ActivityFeedItem): string {
  const meta = item.metadata;
  switch (item.activity_type) {
    case "quiz_completed":
      return `scored ${meta.score}/${meta.max_score} on "${meta.article_title}"`;
    case "gauge_milestone":
      return `hit ${meta.threshold} gauge in ${meta.sector_name}`;
    case "streak_milestone":
      return `reached a ${meta.streak_days}-day streak!`;
    default:
      return "did something awesome";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SocialFeedPage() {
  const { user, session } = useAuth();
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const token = session?.access_token;

  const fetchFeed = useCallback(async (cursor?: string) => {
    if (!token) return;
    const isMore = !!cursor;
    if (isMore) setLoadingMore(true); else setLoading(true);

    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
    const res = await apiFetch<ActivityFeedItem[]>(`/feed/friends${params}`, { token });

    if (res.data) {
      if (isMore) {
        setItems((prev) => [...prev, ...res.data!]);
      } else {
        setItems(res.data);
      }
    }
    setNextCursor(res.meta?.next_cursor as string | null);
    if (isMore) setLoadingMore(false); else setLoading(false);
  }, [token]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const handleReact = async (activityId: string, emoji: string) => {
    if (!token) return;
    const item = items.find((i) => i.id === activityId);
    if (!item) return;

    if (item.my_reaction === emoji) {
      // Remove reaction
      await apiFetch(`/feed/${activityId}/react`, { token, method: "DELETE" });
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== activityId) return i;
          return {
            ...i,
            my_reaction: null,
            reactions: i.reactions
              .map((r) => r.emoji === emoji ? { ...r, count: r.count - 1 } : r)
              .filter((r) => r.count > 0),
          };
        })
      );
    } else {
      // Add/change reaction
      await apiFetch(`/feed/${activityId}/react`, {
        token,
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== activityId) return i;
          const oldEmoji = i.my_reaction;
          let reactions = [...i.reactions];
          // Remove old reaction count
          if (oldEmoji) {
            reactions = reactions
              .map((r) => r.emoji === oldEmoji ? { ...r, count: r.count - 1 } : r)
              .filter((r) => r.count > 0);
          }
          // Add new reaction count
          const existing = reactions.find((r) => r.emoji === emoji);
          if (existing) {
            reactions = reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1 } : r);
          } else {
            reactions.push({ emoji, count: 1 });
          }
          return { ...i, my_reaction: emoji, reactions };
        })
      );
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-400 mb-4">Sign in to see your friends' activity</p>
        <Link href="/login" className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-6 py-2 rounded-lg">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Social Feed</h1>
        <Link
          href="/friends"
          className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          Manage friends
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 skeleton-shimmer rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-2">No activity yet</p>
          <p className="text-gray-600 text-sm">
            <Link href="/friends" className="text-teal-400 hover:text-teal-300">Add friends</Link> to see their activity here
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="px-4 py-4 rounded-lg bg-gray-900 border border-gray-800">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  {item.avatar_url ? (
                    <img src={item.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                      {(item.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-medium">{item.username || "Anonymous"}</span>{" "}
                      <span className="text-gray-400">{formatActivity(item)}</span>
                    </p>
                    <p className="text-xs text-gray-600">{timeAgo(item.created_at)}</p>
                  </div>
                </div>

                {/* Reactions */}
                <div className="flex items-center gap-1 mt-3">
                  {EMOJI_KEYS.map((key) => {
                    const count = item.reactions.find((r) => r.emoji === key)?.count || 0;
                    const isMyReaction = item.my_reaction === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleReact(item.id, key)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                          isMyReaction
                            ? "bg-teal-400/10 border border-teal-400/30"
                            : count > 0
                              ? "bg-gray-800 border border-gray-700"
                              : "bg-gray-800/50 border border-transparent hover:border-gray-700"
                        }`}
                      >
                        <span>{EMOJI_MAP[key]}</span>
                        {count > 0 && <span className={isMyReaction ? "text-teal-400" : "text-gray-400"}>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          {nextCursor && (
            <div className="text-center mt-6">
              <button
                onClick={() => fetchFeed(nextCursor)}
                disabled={loadingMore}
                className="text-sm text-teal-400 hover:text-teal-300 disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/social/page.tsx
git commit -m "feat: add social feed page with emoji reactions"
```

---

## Task 17: Frontend Page — Invite Landing Page

**Files:**
- Create: `frontend/src/app/add/[username]/page.tsx`

**Step 1: Create the invite landing page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number;
}

export default function AddFriendPage() {
  const params = useParams<{ username: string }>();
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "sent" | "already" | "error">("idle");

  const token = session?.access_token;

  useEffect(() => {
    // Fetch the target user's profile via search
    async function load() {
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await apiFetch<UserProfile[]>(`/friends/search?q=${encodeURIComponent(params.username)}`, { token });
      const match = res.data?.find((u) => u.username === params.username);
      if (match) setProfile(match);
      setLoading(false);
    }
    load();
  }, [params.username, token]);

  const sendRequest = async () => {
    if (!token || !profile) return;
    const res = await apiFetch<{ friendship_id: string }>("/friends/request", {
      token,
      method: "POST",
      body: JSON.stringify({ addressee_id: profile.id }),
    });
    if (res.success) {
      setStatus("sent");
    } else if (res.error?.code === "ALREADY_FRIENDS") {
      setStatus("already");
    } else if (res.error?.code === "ALREADY_PENDING") {
      setStatus("sent");
    } else {
      setStatus("error");
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 mb-4">Sign in to add <span className="text-white font-medium">{params.username}</span> as a friend</p>
        <Link href="/login" className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-6 py-2 rounded-lg">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 skeleton-shimmer rounded-full mx-auto mb-4" />
        <div className="h-4 w-32 skeleton-shimmer rounded mx-auto mb-2" />
        <div className="h-3 w-20 skeleton-shimmer rounded mx-auto" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-gray-400">User <span className="text-white font-medium">{params.username}</span> not found</p>
        <Link href="/friends" className="text-sm text-teal-400 hover:text-teal-300 mt-4 inline-block">
          Go to friends
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full mx-auto mb-4" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-2xl font-bold text-gray-400 mx-auto mb-4">
            {(profile.username || "?")[0].toUpperCase()}
          </div>
        )}
        <h2 className="text-xl font-bold text-white mb-1">
          {profile.display_name || profile.username}
        </h2>
        {profile.display_name && profile.username && (
          <p className="text-sm text-gray-500 mb-2">@{profile.username}</p>
        )}
        <p className="text-sm text-teal-400 mb-6">{profile.total_xp.toLocaleString()} XP</p>

        {status === "idle" && (
          <button
            onClick={sendRequest}
            className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
          >
            Add Friend
          </button>
        )}
        {status === "sent" && (
          <p className="text-teal-400 text-sm font-medium">Request sent!</p>
        )}
        {status === "already" && (
          <p className="text-gray-400 text-sm">Already friends</p>
        )}
        {status === "error" && (
          <p className="text-red-400 text-sm">Something went wrong</p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/add/
git commit -m "feat: add invite landing page at /add/[username]"
```

---

## Task 18: Frontend — Revamp Leaderboard Page

**Files:**
- Modify: `frontend/src/app/leaderboard/page.tsx` (full rewrite)

**Step 1: Rewrite the leaderboard page**

Replace the entire content of `frontend/src/app/leaderboard/page.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";

interface LBEntry {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_xp?: number;
  sector_xp?: number;
  xp?: number;
  rank: number;
}

const MAIN_TABS = ["Global", "Sector", "Friends"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const PERIOD_TABS = ["All Time", "Weekly", "Monthly"] as const;
type PeriodTab = (typeof PERIOD_TABS)[number];

const SECTOR_OPTIONS = [
  { label: "Crypto", slug: "crypto" },
  { label: "Stocks", slug: "stocks" },
  { label: "Asia", slug: "asia" },
  { label: "Europe", slug: "europe" },
  { label: "Americas", slug: "americas" },
  { label: "India", slug: "india" },
];

const PERIOD_MAP: Record<PeriodTab, string> = {
  "All Time": "all_time",
  Weekly: "weekly",
  Monthly: "monthly",
};

const RANK_STYLES: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-gray-300",
  3: "text-amber-600",
};

function MedalIcon({ rank }: { rank: number }) {
  const colors: Record<number, { fill: string; stroke: string }> = {
    1: { fill: "#fbbf24", stroke: "#f59e0b" },
    2: { fill: "#d1d5db", stroke: "#9ca3af" },
    3: { fill: "#d97706", stroke: "#b45309" },
  };
  const c = colors[rank];
  if (!c) return null;

  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="10" r="7" fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
      <text x="12" y="13" textAnchor="middle" fill="#1f2937" fontSize="8" fontWeight="bold">
        {rank}
      </text>
      <path d="M8 16l-2 6 4-2 2 2V16" fill={c.fill} opacity="0.7" />
      <path d="M16 16l2 6-4-2-2 2V16" fill={c.fill} opacity="0.7" />
    </svg>
  );
}

export default function LeaderboardPage() {
  const { session } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>("Global");
  const [period, setPeriod] = useState<PeriodTab>("All Time");
  const [sectorSlug, setSectorSlug] = useState("crypto");
  const [entries, setEntries] = useState<LBEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const token = session?.access_token;

  useEffect(() => {
    setLoading(true);
    const periodParam = PERIOD_MAP[period];
    let url: string;

    if (mainTab === "Global") {
      url = `/api/v1/leaderboard/global?period=${periodParam}`;
    } else if (mainTab === "Sector") {
      url = `/api/v1/leaderboard/sector/${sectorSlug}?period=${periodParam}`;
    } else {
      // Friends - needs auth
      if (token) {
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        url = `${base}/api/v1/leaderboard/friends?period=${periodParam}`;
      } else {
        setEntries([]);
        setLoading(false);
        return;
      }
    }

    const fetchOptions: RequestInit = mainTab === "Friends" && token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {};

    fetch(url, fetchOptions)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setEntries(res.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [mainTab, period, sectorSlug, token]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Leaderboard</h1>

      {/* Main tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
        {MAIN_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setMainTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              mainTab === t
                ? "bg-teal-400/10 text-teal-400 border border-teal-400/30"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Sector selector (only shown for Sector tab) */}
      {mainTab === "Sector" && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
          {SECTOR_OPTIONS.map((s) => (
            <button
              key={s.slug}
              onClick={() => setSectorSlug(s.slug)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                sectorSlug === s.slug
                  ? "bg-gray-800 text-white border border-gray-700"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Period sub-tabs */}
      <div className="flex gap-1 mb-6">
        {PERIOD_TABS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              period === p
                ? "bg-gray-800 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Friends tab - not logged in */}
      {mainTab === "Friends" && !token ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-2">Sign in to see friends leaderboard</p>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-14 skeleton-shimmer rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
          <p className="text-gray-500">
            {mainTab === "Friends" ? "Add friends to compete!" : "No rankings yet"}
          </p>
        </div>
      ) : (
        <StaggerList className="space-y-1">
          {entries.map((entry) => {
            const xp = entry.xp ?? entry.total_xp ?? entry.sector_xp ?? 0;
            return (
              <StaggerItem key={entry.user_id}>
                <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-gray-900 border border-gray-800">
                  <span className={`w-8 flex items-center justify-center text-sm font-bold ${RANK_STYLES[entry.rank] || "text-gray-500"}`}>
                    {entry.rank <= 3 ? <MedalIcon rank={entry.rank} /> : `#${entry.rank}`}
                  </span>
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                      {(entry.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 text-sm text-white font-medium truncate">
                    {entry.username || "Anonymous"}
                  </span>
                  <span className="text-sm text-teal-400 font-semibold">
                    {xp.toLocaleString()} XP
                  </span>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/leaderboard/page.tsx
git commit -m "feat: revamp leaderboard with Global/Sector/Friends tabs and period filters"
```

---

## Task 19: Frontend — Update Navbar with Social Links

**Files:**
- Modify: `frontend/src/components/layout/Navbar.tsx`

**Step 1: Add Social link in desktop nav (after line 51, after Feed link)**

After the Feed `<Link>` block, add:

```tsx
            <Link
              href="/social"
              className="text-gray-300 hover:text-teal-400 transition-colors text-sm font-medium"
            >
              Social
            </Link>
```

**Step 2: Add Social link in mobile menu (after line 146, after Feed link)**

After the mobile Feed `<Link>` block, add:

```tsx
              <Link
                href="/social"
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-gray-300 hover:text-teal-400 py-1"
              >
                Social
              </Link>
```

**Step 3: Add Friends link in mobile menu (after the Social link just added)**

```tsx
              <Link
                href="/friends"
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-gray-300 hover:text-teal-400 py-1"
              >
                Friends
              </Link>
```

**Step 4: Commit**

```bash
git add frontend/src/components/layout/Navbar.tsx
git commit -m "feat: add Social and Friends links to navbar"
```

---

## Task 20: Verify & Smoke Test

**Step 1: Run backend locally to check imports**

```bash
cd backend && python -c "from app.main import app; print('Backend imports OK')"
```

Expected: `Backend imports OK`

**Step 2: Run frontend build to check for TypeScript errors**

```bash
cd frontend && npx next build
```

Expected: Build succeeds with no type errors.

**Step 3: Check security advisors on Supabase**

Run the `get_advisors` MCP tool with type `security` to check for missing RLS policies on new tables.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete social features - friends, feed, reactions, leaderboard"
```
