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
    article_ids_result = supabase.table("article_sectors").select("article_id").in_("sector_id", sector_ids).execute()
    ids = list(set(r["article_id"] for r in article_ids_result.data))
    if not ids:
        return [], 0

    offset = (page - 1) * limit
    result = (
        supabase.table("articles")
        .select("*, article_sectors(sector_id, sectors(name, slug, category))", count="exact")
        .eq("processing_status", "done")
        .in_("id", ids)
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


async def insert_quiz_attempt(user_id: str, quiz_id: int, score: int, total: int, xp: int):
    supabase.table("quiz_attempts").insert({
        "user_id": user_id,
        "quiz_id": quiz_id,
        "score": score,
        "total_questions": total,
        "xp_earned": xp,
    }).execute()


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


# --- Leaderboard ---

async def get_global_leaderboard():
    result = supabase.table("leaderboard_global").select("*").order("rank").execute()
    return result.data


async def get_sector_leaderboard(sector_id: int):
    result = supabase.table("leaderboard_sector").select("*").eq("sector_id", sector_id).order("rank").execute()
    return result.data


async def get_user_rank(user_id: str):
    result = supabase.table("leaderboard_global").select("*").eq("user_id", user_id).execute()
    return result.data[0] if result.data else None


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
