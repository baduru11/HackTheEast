from datetime import datetime, timedelta

from app.dependencies import supabase


# --- Articles ---

async def get_articles(
    sector: str | None = None,
    category: str | None = None,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
):
    query = supabase.table("articles").select(
        "*, article_sectors(sector_id, sectors(name, slug, category))",
        count="exact",
    )

    if status:
        query = query.eq("processing_status", status)
    else:
        query = query.eq("processing_status", "done")

    if sector:
        sector_row = supabase.table("sectors").select("id").eq("slug", sector).single().execute()
        if sector_row.data:
            article_ids = supabase.table("article_sectors").select("article_id").eq("sector_id", sector_row.data["id"]).execute()
            ids = [r["article_id"] for r in article_ids.data]
            if ids:
                query = query.in_("id", ids)
            else:
                return [], 0
    elif category:
        sector_rows = supabase.table("sectors").select("id").eq("category", category).execute()
        sector_ids = [r["id"] for r in sector_rows.data]
        article_ids = supabase.table("article_sectors").select("article_id").in_("sector_id", sector_ids).execute()
        ids = list(set(r["article_id"] for r in article_ids.data))
        if ids:
            query = query.in_("id", ids)
        else:
            return [], 0

    offset = (page - 1) * limit
    result = query.order("published_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data, result.count


async def get_article_by_id(article_id: int):
    result = supabase.table("articles").select(
        "id, finnhub_id, gnews_url, source_name, headline, snippet, original_url, image_url, author, published_at, language, ai_summary, ai_tutorial, lesson_data, processing_status, created_at, updated_at, article_sectors(sector_id, sectors(name, slug)), article_tickers(*)"
    ).eq("id", article_id).single().execute()
    return result.data


async def insert_article(data: dict) -> int:
    result = supabase.table("articles").insert(data).execute()
    return result.data[0]["id"]


async def update_article(article_id: int, data: dict):
    supabase.table("articles").update(data).eq("id", article_id).execute()


async def article_exists(finnhub_id: str | None = None, gnews_url: str | None = None, original_url: str | None = None) -> bool:
    if finnhub_id:
        result = supabase.table("articles").select("id").eq("finnhub_id", finnhub_id).execute()
        if result.data:
            return True
    if gnews_url:
        result = supabase.table("articles").select("id").eq("gnews_url", gnews_url).execute()
        if result.data:
            return True
    if original_url:
        result = supabase.table("articles").select("id").eq("original_url", original_url).execute()
        if result.data:
            return True
    return False


async def insert_article_sectors(article_id: int, sector_ids: list[int]):
    rows = [{"article_id": article_id, "sector_id": sid} for sid in sector_ids]
    supabase.table("article_sectors").insert(rows).execute()


async def insert_article_tickers(article_id: int, tickers: list[dict]):
    rows = [{"article_id": article_id, **t} for t in tickers]
    supabase.table("article_tickers").insert(rows).execute()


async def get_articles_by_sector_ids(
    sector_ids: list[int],
    page: int = 1,
    limit: int = 20,
):
    offset = (page - 1) * limit
    result = (
        supabase.table("articles")
        .select("*, article_sectors!inner(sector_id, sectors(name, slug, category))", count="exact")
        .eq("processing_status", "done")
        .in_("article_sectors.sector_id", sector_ids)
        .order("published_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data, result.count


# --- Quizzes ---

async def insert_quiz(article_id: int, questions: list[dict]) -> int:
    # Check if quiz already exists (UNIQUE constraint on article_id)
    existing = supabase.table("quizzes").select("id").eq("article_id", article_id).execute()
    if existing.data:
        return existing.data[0]["id"]
    quiz = supabase.table("quizzes").insert({"article_id": article_id}).execute()
    quiz_id = quiz.data[0]["id"]
    rows = [
        {
            "quiz_id": quiz_id,
            "question_text": q["question"],
            "options": q["options"],
            "correct_index": q["correct_index"],
            "explanation": q["explanation"],
            "order_num": i + 1,
            "question_type": q.get("question_type"),
        }
        for i, q in enumerate(questions)
    ]
    supabase.table("quiz_questions").insert(rows).execute()
    return quiz_id


async def get_quiz_by_article(article_id: int):
    result = supabase.table("quizzes").select(
        "*, quiz_questions(*)"
    ).eq("article_id", article_id).single().execute()
    return result.data


async def get_quiz_attempt(user_id: str, quiz_id: int):
    result = supabase.table("quiz_attempts").select("*").eq("user_id", user_id).eq("quiz_id", quiz_id).execute()
    return result.data[0] if result.data else None


async def insert_quiz_attempt(user_id: str, quiz_id: int, score: int, total: int, xp: int, user_answers: list[int] | None = None):
    row = {
        "user_id": user_id,
        "quiz_id": quiz_id,
        "score": score,
        "total_questions": total,
        "xp_earned": xp,
    }
    if user_answers is not None:
        row["user_answers"] = user_answers
    supabase.table("quiz_attempts").insert(row).execute()


# --- Profiles ---

async def get_profile(user_id: str):
    result = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    return result.data


async def update_profile(user_id: str, data: dict):
    supabase.table("profiles").update(data).eq("id", user_id).execute()


async def add_xp(user_id: str, amount: int):
    supabase.rpc("increment_xp", {"uid": user_id, "amount": amount}).execute()


# --- Favorites ---

async def get_user_favorites(user_id: str):
    result = supabase.table("user_favorites").select(
        "*, sectors(name, slug, category)"
    ).eq("user_id", user_id).execute()
    return result.data


async def add_favorite(user_id: str, sector_id: int):
    supabase.table("user_favorites").insert({
        "user_id": user_id,
        "sector_id": sector_id,
        "gauge_score": 50,
    }).execute()


async def remove_favorite(user_id: str, sector_id: int):
    supabase.table("user_favorites").delete().eq("user_id", user_id).eq("sector_id", sector_id).execute()


async def update_gauge(user_id: str, sector_id: int, new_score: int):
    clamped = max(0, min(100, new_score))
    supabase.table("user_favorites").update({
        "gauge_score": clamped,
        "gauge_updated_at": datetime.utcnow().isoformat(),
    }).eq("user_id", user_id).eq("sector_id", sector_id).execute()


async def get_all_favorites_with_users():
    result = supabase.table("user_favorites").select("*").execute()
    return result.data


# --- Notifications ---

async def insert_notification(user_id: str, type: str, title: str, body: str, link: str | None = None):
    supabase.table("notifications").insert({
        "user_id": user_id,
        "type": type,
        "title": title,
        "body": body,
        "link": link,
    }).execute()


async def get_notifications(user_id: str, page: int = 1, limit: int = 20):
    offset = (page - 1) * limit
    result = supabase.table("notifications").select("*", count="exact").eq(
        "user_id", user_id
    ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data, result.count


async def mark_notification_read(notification_id: int, user_id: str):
    supabase.table("notifications").update({"read": True}).eq("id", notification_id).eq("user_id", user_id).execute()


async def mark_all_notifications_read(user_id: str):
    supabase.table("notifications").update({"read": True}).eq("user_id", user_id).eq("read", False).execute()


async def delete_all_notifications(user_id: str):
    supabase.table("notifications").delete().eq("user_id", user_id).execute()


async def delete_notification(notification_id: int, user_id: str):
    supabase.table("notifications").delete().eq("id", notification_id).eq("user_id", user_id).execute()


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
    result = supabase.table("leaderboard_sector").select("*").eq("sector_id", sector_id).order("rank").limit(20).execute()
    return result.data


async def get_user_rank(user_id: str):
    result = supabase.table("leaderboard_global").select("*").eq("user_id", user_id).execute()
    return result.data[0] if result.data else None


async def get_users_fav_sectors(user_ids: list[str]) -> dict[str, dict]:
    """Return each user's top sector by XP and what % of their quiz XP it represents."""
    if not user_ids:
        return {}
    # Query sector breakdown from materialized view
    result = (
        supabase.table("leaderboard_sector")
        .select("user_id, sector_id, sector_xp")
        .in_("user_id", user_ids)
        .execute()
    )
    if not result.data:
        return {}

    # Build sector name map
    sectors_result = supabase.table("sectors").select("id, name, slug").execute()
    sector_map = {s["id"]: s for s in (sectors_result.data or [])}

    # Group by user, find top sector and compute %
    from collections import defaultdict
    user_sectors: dict[str, list[dict]] = defaultdict(list)
    for row in result.data:
        user_sectors[row["user_id"]].append(row)

    out: dict[str, dict] = {}
    for uid, rows in user_sectors.items():
        total_xp = sum(r["sector_xp"] for r in rows)
        top = max(rows, key=lambda r: r["sector_xp"])
        sector_info = sector_map.get(top["sector_id"], {})
        pct = round(top["sector_xp"] * 100 / total_xp) if total_xp > 0 else 0
        out[uid] = {
            "fav_sector": sector_info.get("name"),
            "fav_sector_slug": sector_info.get("slug"),
            "fav_sector_pct": pct,
        }
    return out


async def get_users_sector_breakdown(user_ids: list[str]) -> dict[str, list[dict]]:
    """Return top 3 sectors per user, with fill % as share of user's total sector XP."""
    if not user_ids:
        return {}
    result = (
        supabase.table("leaderboard_sector")
        .select("user_id, sector_id, sector_xp")
        .in_("user_id", user_ids)
        .execute()
    )
    if not result.data:
        return {}

    sectors_result = supabase.table("sectors").select("id, name, slug").execute()
    sector_map = {s["id"]: s for s in (sectors_result.data or [])}

    from collections import defaultdict
    user_sectors: dict[str, list[dict]] = defaultdict(list)
    for row in result.data:
        user_sectors[row["user_id"]].append(row)

    out: dict[str, list[dict]] = {}
    for uid, rows in user_sectors.items():
        sorted_rows = sorted(rows, key=lambda r: r["sector_xp"], reverse=True)
        total_xp = sum(r["sector_xp"] for r in sorted_rows) or 1
        out[uid] = [
            {
                "name": sector_map.get(r["sector_id"], {}).get("name"),
                "slug": sector_map.get(r["sector_id"], {}).get("slug"),
                "xp": r["sector_xp"],
                "fill": round(r["sector_xp"] * 100 / total_xp),
            }
            for r in sorted_rows[:3]
            if sector_map.get(r["sector_id"])
        ]
    return out


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

    # Attach favourite sector info
    fav_sectors = await get_users_fav_sectors(all_ids)
    for entry in entries:
        info = fav_sectors.get(entry["user_id"], {})
        entry["fav_sector"] = info.get("fav_sector")
        entry["fav_sector_slug"] = info.get("fav_sector_slug")
        entry["fav_sector_pct"] = info.get("fav_sector_pct")

    return entries


async def refresh_leaderboards():
    supabase.rpc("refresh_leaderboards").execute()


# --- Sectors ---

async def get_all_sectors():
    result = supabase.table("sectors").select("*").execute()
    return result.data


async def get_sector_by_slug(slug: str):
    result = supabase.table("sectors").select("*").eq("slug", slug).single().execute()
    return result.data


# --- Streak ---

async def get_streak_days(user_id: str) -> int:
    result = supabase.table("quiz_attempts").select("completed_at").eq(
        "user_id", user_id
    ).order("completed_at", desc=True).execute()

    if not result.data:
        return 0

    dates = sorted(set(
        datetime.fromisoformat(r["completed_at"]).date()
        for r in result.data
    ), reverse=True)

    if not dates:
        return 0

    today = datetime.utcnow().date()
    if dates[0] != today and dates[0] != today - timedelta(days=1):
        return 0

    streak = 1
    for i in range(1, len(dates)):
        if (dates[i - 1] - dates[i]).days == 1:
            streak += 1
        else:
            break
    return streak


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
    """Search profiles by username or display_name (partial match), excluding current user."""
    result = supabase.table("profiles").select(
        "id, username, display_name, avatar_url, total_xp"
    ).or_(f"username.ilike.%{query}%,display_name.ilike.%{query}%").neq("id", current_user_id).limit(10).execute()
    return result.data


async def get_profile_by_username(username: str) -> dict | None:
    result = supabase.table("profiles").select(
        "id, username, display_name, avatar_url, total_xp"
    ).eq("username", username).execute()
    return result.data[0] if result.data else None


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
    return len(result.data) > 0


async def get_friends_feed(user_id: str, friend_ids: list[str], cursor: str | None = None, limit: int = 20) -> list[dict]:
    """Get activity feed for a list of friend IDs."""
    if not friend_ids:
        return []

    query = supabase.table("activity_feed").select(
        "*, profiles!activity_feed_user_id_fkey(username, display_name, avatar_url)"
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


# ── Daily Quiz ──────────────────────────────────────────────

async def get_daily_quiz_by_date(date_str: str):
    result = supabase.table("daily_quizzes").select("*").eq("date", date_str).limit(1).execute()
    return result.data[0] if result.data else None


async def insert_daily_quiz(date_str: str, questions: list[dict], source_article_ids: list[int]):
    result = supabase.table("daily_quizzes").insert({
        "date": date_str,
        "questions": questions,
        "source_article_ids": source_article_ids,
    }).execute()
    return result.data[0] if result.data else None


async def get_daily_quiz_attempt(user_id: str, quiz_id: int):
    result = (
        supabase.table("daily_quiz_attempts")
        .select("*")
        .eq("user_id", user_id)
        .eq("quiz_id", quiz_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def insert_daily_quiz_attempt(user_id: str, quiz_id: int, answers: list[int], score: int, total: int, xp_earned: int):
    result = supabase.table("daily_quiz_attempts").insert({
        "user_id": user_id,
        "quiz_id": quiz_id,
        "answers": answers,
        "score": score,
        "total_questions": total,
        "xp_earned": xp_earned,
    }).execute()
    return result.data[0] if result.data else None


# ── Predict (Stock Predictions) ────────────────────────────

async def get_active_stock_pool():
    result = supabase.table("stock_pool").select("ticker, name").eq("active", True).execute()
    return result.data or []


async def get_daily_stocks(date_str: str):
    result = supabase.table("daily_stocks").select("*").eq("date", date_str).limit(1).execute()
    return result.data[0] if result.data else None


async def insert_daily_stocks(date_str: str, tickers: list[str]):
    result = supabase.table("daily_stocks").insert({
        "date": date_str,
        "tickers": tickers,
    }).execute()
    return result.data[0] if result.data else None


async def get_user_prediction(user_id: str, date_str: str, ticker: str):
    result = (
        supabase.table("predictions")
        .select("*")
        .eq("user_id", user_id)
        .eq("date", date_str)
        .eq("ticker", ticker)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def insert_prediction(user_id: str, date_str: str, ticker: str, direction: str, price_at_bet: float):
    result = supabase.table("predictions").insert({
        "user_id": user_id,
        "date": date_str,
        "ticker": ticker,
        "direction": direction,
        "price_at_bet": price_at_bet,
    }).execute()
    return result.data[0] if result.data else None


async def get_user_predictions(user_id: str, limit: int = 20):
    result = (
        supabase.table("predictions")
        .select("*, stock_pool(name)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


async def get_pending_predictions():
    result = (
        supabase.table("predictions")
        .select("*")
        .eq("result", "pending")
        .execute()
    )
    return result.data or []


async def resolve_prediction(prediction_id: int, price_at_close: float, result: str, xp_earned: int):
    from datetime import datetime, timezone
    supabase.table("predictions").update({
        "price_at_close": price_at_close,
        "result": result,
        "xp_earned": xp_earned,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", prediction_id).execute()


# --- Weekly Reports ---

async def get_weekly_report(report_id: int, user_id: str):
    result = supabase.table("weekly_reports").select("*").eq("id", report_id).eq("user_id", user_id).single().execute()
    return result.data


async def get_latest_weekly_report(user_id: str):
    result = supabase.table("weekly_reports").select("*").eq("user_id", user_id).order("week_start", desc=True).limit(1).execute()
    return result.data[0] if result.data else None


async def get_weekly_reports(user_id: str, page: int = 1, limit: int = 10):
    offset = (page - 1) * limit
    result = supabase.table("weekly_reports").select("*", count="exact").eq(
        "user_id", user_id
    ).order("week_start", desc=True).range(offset, offset + limit - 1).execute()
    return result.data, result.count


async def insert_weekly_report(data: dict):
    result = supabase.table("weekly_reports").insert(data).execute()
    return result.data[0] if result.data else None


async def update_weekly_report(report_id: int, data: dict):
    supabase.table("weekly_reports").update(data).eq("id", report_id).execute()


async def get_users_with_favorites():
    """Get distinct user_ids that have at least one favorite sector."""
    result = supabase.table("user_favorites").select("user_id").execute()
    return list(set(r["user_id"] for r in result.data))


async def get_user_quiz_attempts_for_week(user_id: str, week_start: str, week_end: str):
    """Get all quiz attempts for a user within a date range, with questions."""
    result = supabase.table("quiz_attempts").select(
        "*, quizzes(article_id, quiz_questions(question_text, options, correct_index, explanation))"
    ).eq("user_id", user_id).gte("completed_at", week_start).lte("completed_at", week_end).execute()
    return result.data or []


async def get_user_daily_quiz_attempts_for_week(user_id: str, week_start: str, week_end: str):
    """Get all daily quiz attempts for a user within a date range."""
    result = supabase.table("daily_quiz_attempts").select(
        "*, daily_quizzes(questions)"
    ).eq("user_id", user_id).gte("completed_at", week_start).lte("completed_at", week_end).execute()
    return result.data or []


async def get_articles_for_sectors_in_range(sector_ids: list[int], start_date: str, end_date: str):
    """Get articles published in a date range for given sectors."""
    article_ids_result = supabase.table("article_sectors").select("article_id").in_("sector_id", sector_ids).execute()
    ids = list(set(r["article_id"] for r in article_ids_result.data))
    if not ids:
        return []
    result = supabase.table("articles").select(
        "id, headline, ai_summary, published_at, article_sectors(sector_id)"
    ).eq("processing_status", "done").in_("id", ids).gte("published_at", start_date).lte("published_at", end_date).order("published_at", desc=True).execute()
    return result.data or []
