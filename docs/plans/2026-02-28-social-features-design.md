# Social Features Design

## Overview

Add social features to FinaMeter: friend system, activity feed with emoji reactions, and improved leaderboards with time-based and friends rankings.

---

## 1. Database Schema

### friendships

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| requester_id | uuid, FK → profiles | Who sent the request |
| addressee_id | uuid, FK → profiles | Who received it |
| status | enum: pending, accepted, rejected | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

- UNIQUE on `(requester_id, addressee_id)`
- RLS: users only see rows where they are requester or addressee
- Unfriend = delete the row

### activity_feed

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| user_id | uuid, FK → profiles | Who performed the activity |
| activity_type | enum: quiz_completed, gauge_milestone, streak_milestone | |
| metadata | jsonb | Flexible payload per type |
| created_at | timestamptz | |

- Index on `(user_id, created_at DESC)`
- Metadata per type:
  - `quiz_completed`: `{ article_id, article_title, score, max_score }`
  - `gauge_milestone`: `{ sector_name, gauge_score, threshold }` (thresholds: 80, 90, 100)
  - `streak_milestone`: `{ streak_days }` (milestones: 7, 14, 30)

### activity_reactions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| activity_id | uuid, FK → activity_feed | |
| user_id | uuid, FK → profiles | Who reacted |
| emoji | text | CHECK in ('fire','brain','clap','rocket','flex','bullseye') |
| created_at | timestamptz | |

- UNIQUE on `(activity_id, user_id)` — one reaction per user per activity
- RLS: users can only react to activities from their accepted friends
- Emoji key mapping (frontend): fire→🔥 brain→🧠 clap→👏 rocket→🚀 flex→💪 bullseye→🎯

### Leaderboard materialized views (new)

- `leaderboard_weekly` — XP earned in the last 7 days, computed from `quiz_attempts`
- `leaderboard_monthly` — XP earned in the last 30 days, computed from `quiz_attempts`
- Refreshed by existing scheduler job every 5 min
- Friends leaderboard is a live query (no materialized view needed)

---

## 2. API Endpoints

### Friendships

| Method | Path | Description |
|--------|------|-------------|
| POST | /friends/request | Send friend request. Body: `{ addressee_id }` |
| POST | /friends/accept/{friendship_id} | Accept pending request |
| POST | /friends/reject/{friendship_id} | Reject pending request |
| DELETE | /friends/{friendship_id} | Unfriend |
| GET | /friends | List accepted friends (returns profiles) |
| GET | /friends/requests | List pending incoming requests |
| GET | /friends/search?q=username | Search users by username |
| GET | /friends/invite-link | Generate shareable invite link |

### Activity Feed

| Method | Path | Description |
|--------|------|-------------|
| GET | /feed/friends?cursor=&limit=20 | Paginated friends activity feed, newest first |
| POST | /feed/{activity_id}/react | Add/change reaction. Body: `{ emoji }` |
| DELETE | /feed/{activity_id}/react | Remove reaction |

### Leaderboard (updated)

| Method | Path | Description |
|--------|------|-------------|
| GET | /leaderboard/global?period=all_time\|weekly\|monthly | Top 20 global |
| GET | /leaderboard/sector/{sector_id}?period=all_time\|weekly\|monthly | Top 20 per sector |
| GET | /leaderboard/friends?period=all_time\|weekly\|monthly | Friends ranking (all friends) |
| GET | /leaderboard/me | Current user's rank in global + favorite sectors |

---

## 3. Activity Insert Logic

Activities are inserted server-side automatically. No user action needed.

### Quiz completed

Inside `POST /quizzes/{quiz_id}/attempt` handler, after saving attempt:

```
INSERT activity_feed (user_id, activity_type, metadata)
→ quiz_completed, { article_id, article_title, score, max_score }
```

### Gauge milestone

Inside gauge recalculation, when score crosses 80, 90, or 100:

```
INSERT activity_feed (user_id, activity_type, metadata)
→ gauge_milestone, { sector_name, gauge_score, threshold }
```

Deduplicate: skip if identical milestone exists within last 24 hours.

### Streak milestone

Inside streak check, when streak hits 7, 14, or 30:

```
INSERT activity_feed (user_id, activity_type, metadata)
→ streak_milestone, { streak_days }
```

---

## 4. Notifications

Minimal — only friend request events, using the existing notifications table.

- **Friend request received** → notification to addressee: "**{username}** sent you a friend request"
- **Friend request accepted** → notification to requester: "**{username}** accepted your friend request"

No notifications for reactions, milestones, or feed activity.

---

## 5. Feed Query Logic

`GET /feed/friends`:

1. Get current user's accepted friend IDs from `friendships`
2. Query `activity_feed` where `user_id IN (friend_ids)`, ordered by `created_at DESC`
3. Cursor-based pagination (cursor = last activity's created_at + id)
4. For each activity, join `activity_reactions` to get:
   - Reaction counts per emoji
   - Whether current user has reacted (and which emoji)
5. Join `profiles` for friend avatar + username
6. Return limit of 20 per page

---

## 6. Frontend

### New page: /social

Social activity feed for friends.

- Infinite scroll, cursor-based pagination
- Each activity card: friend avatar + username, activity description, relative timestamp
- Reaction bar at bottom of each card: 6 emoji buttons with counts, highlighted if user reacted
- Empty state: "Add friends to see their activity here"

### New page: /friends

Friend management.

- **Search bar** — search by username, inline results
- **Pending requests** — incoming requests with Accept/Reject buttons
- **Friends list** — grid of friend cards: avatar, username, top sector gauge, XP
  - Each card has Unfriend option (behind overflow menu)
- **Invite link button** — copies `finameter.com/add/{username}` to clipboard

### New page: /add/{username}

Invite landing page.

- Target user's profile card (avatar, username, XP, top sectors)
- "Add Friend" button (or redirect to login if not authenticated)
- "Already friends" state if already connected
- "Request pending" state if already sent

### Updated page: /leaderboard

- Top-level tabs: **Global | Sector | Friends**
- Sub-tabs: **All Time | Weekly | Monthly**
- Max 20 rows (except friends tab — shows all friends)
- Current user's row highlighted if present

### Navbar update

- Add "Social" icon/link to navigation (between Feed and Leaderboard)

---

## 7. Emoji Mapping

| Key | Emoji | Meaning |
|-----|-------|---------|
| fire | 🔥 | Hot / impressive |
| brain | 🧠 | Smart / brainy |
| clap | 👏 | Well done |
| rocket | 🚀 | Going up |
| flex | 💪 | Strong effort |
| bullseye | 🎯 | Nailed it |
