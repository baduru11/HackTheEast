import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from app.db import supabase as db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/articles", tags=["articles"])

IS_DEBUG = os.getenv("DEBUG", "false").lower() == "true"


@router.get("/feed")
async def get_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user),
):
    favorites = await db.get_user_favorites(user_id)
    if not favorites:
        return {"success": True, "data": [], "meta": {"page": page, "limit": limit, "total": 0}}

    sector_ids = [f["sector_id"] for f in favorites]
    articles, total = await db.get_articles_by_sector_ids(sector_ids, page=page, limit=limit)
    return {
        "success": True,
        "data": articles,
        "meta": {"page": page, "limit": limit, "total": total},
    }


@router.get("")
async def list_articles(
    sector: str | None = Query(None),
    category: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    articles, total = await db.get_articles(
        sector=sector, category=category, page=page, limit=limit
    )
    return {
        "success": True,
        "data": articles,
        "meta": {"page": page, "limit": limit, "total": total},
    }


@router.get("/headlines")
async def get_headlines():
    # Hero: most recent article
    all_articles, _ = await db.get_articles(page=1, limit=20)

    hero = all_articles[0] if all_articles else None
    trending = all_articles[1:5] if len(all_articles) > 1 else []

    # World and markets previews
    world_articles, _ = await db.get_articles(category="world", page=1, limit=4)
    market_articles, _ = await db.get_articles(category="markets", page=1, limit=4)

    return {
        "success": True,
        "data": {
            "hero": hero,
            "trending": trending,
            "world": world_articles,
            "markets": market_articles,
        },
    }


@router.get("/debug/process")
async def debug_process(user_id: str = Depends(get_current_user)):
    """Manually trigger pipeline processing (debug mode only)."""
    if not IS_DEBUG:
        raise HTTPException(status_code=404, detail="Not found")
    from app.services.pipeline import process_pending_articles, recover_stuck_articles
    results = {"recover": None, "process": None}
    try:
        await recover_stuck_articles()
        results["recover"] = "ok"
    except Exception as e:
        results["recover"] = str(e)
    try:
        await process_pending_articles(batch_size=2)
        results["process"] = "ok"
    except Exception as e:
        results["process"] = str(e)
    return results


@router.get("/debug/bulk")
async def debug_bulk(background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user)):
    """Kick off bulk processing (debug mode only)."""
    if not IS_DEBUG:
        raise HTTPException(status_code=404, detail="Not found")
    background_tasks.add_task(_bulk_process)
    _, pending_count = await db.get_articles(status="pending", page=1, limit=1)
    return {"status": "started", "pending": pending_count or 0}


async def _bulk_process():
    from app.services.pipeline import process_pending_articles, recover_stuck_articles
    await recover_stuck_articles()
    max_rounds = 50
    rounds = 0
    while rounds < max_rounds:
        articles, _ = await db.get_articles(status="pending", page=1, limit=1)
        if not articles:
            break
        await process_pending_articles(batch_size=3)
        rounds += 1
    print(f"Bulk processing done: {rounds} rounds")


@router.get("/debug/fix-sources")
async def debug_fix_sources(background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user)):
    """Resolve redirect URLs and fix source names (debug mode only)."""
    if not IS_DEBUG:
        raise HTTPException(status_code=404, detail="Not found")
    background_tasks.add_task(_fix_sources)
    return {"status": "started"}


async def _fix_sources():
    from app.services.pipeline import resolve_url
    # Get all done articles with finnhub proxy URLs
    result = db.supabase.table("articles").select("id, original_url, source_name").eq(
        "processing_status", "done"
    ).like("original_url", "%finnhub.io/api/news%").execute()

    fixed = 0
    for article in result.data:
        final_url, real_source = await resolve_url(article["original_url"])
        updates = {}
        if final_url != article["original_url"]:
            updates["original_url"] = final_url
        if real_source:
            updates["source_name"] = real_source
        if updates:
            await db.update_article(article["id"], updates)
            fixed += 1
    print(f"Fixed sources for {fixed} articles")


@router.get("/debug/reprocess-lessons")
async def debug_reprocess_lessons(background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user)):
    """Re-process existing articles with the new lesson prompt (debug mode only)."""
    if not IS_DEBUG:
        raise HTTPException(status_code=404, detail="Not found")
    background_tasks.add_task(_reprocess_lessons)
    # Count articles needing reprocessing
    result = db.supabase.table("articles").select("id", count="exact").eq(
        "processing_status", "done"
    ).is_("lesson_data", "null").execute()
    return {"status": "started", "pending": result.count or 0}


async def _reprocess_lessons():
    import json
    from app.services import llm

    # Get all done articles without lesson_data
    result = db.supabase.table("articles").select(
        "id, headline, raw_content"
    ).eq("processing_status", "done").is_("lesson_data", "null").execute()

    articles = result.data or []
    print(f"Reprocessing {len(articles)} articles for lessons")

    processed = 0
    for article in articles:
        article_id = article["id"]
        raw_text = article.get("raw_content") or ""
        headline = article.get("headline", "")

        if not raw_text or len(raw_text) < 20:
            continue

        try:
            lesson = await llm.generate_lesson(headline, raw_text)
            if not lesson:
                continue

            await db.update_article(article_id, {
                "ai_summary": lesson.summary,
                "lesson_data": json.dumps(lesson.model_dump()),
            })

            # Check if quiz_attempts exist for this article's quiz
            existing_quiz = await db.get_quiz_by_article(article_id)
            if existing_quiz:
                quiz_id = existing_quiz["id"]
                attempts = db.supabase.table("quiz_attempts").select("id").eq("quiz_id", quiz_id).limit(1).execute()
                if attempts.data:
                    # Skip quiz recreation — users have attempted it
                    processed += 1
                    continue
                # Delete old quiz questions and quiz
                db.supabase.table("quiz_questions").delete().eq("quiz_id", quiz_id).execute()
                db.supabase.table("quizzes").delete().eq("id", quiz_id).execute()

            # Create new 6-question quiz
            quiz_rows = [
                {
                    "question": q.prompt,
                    "options": q.options,
                    "correct_index": q.correct_index,
                    "explanation": q.explanation,
                    "question_type": q.type,
                }
                for q in lesson.quiz
            ]
            await db.insert_quiz(article_id, quiz_rows)

            processed += 1
            if processed % 5 == 0:
                print(f"Reprocessed {processed}/{len(articles)} articles")
        except Exception as e:
            print(f"Reprocess error for article {article_id}: {e}")

    print(f"Reprocessing complete: {processed}/{len(articles)} articles")


@router.get("/{article_id}")
async def get_article(article_id: int):
    article = await db.get_article_by_id(article_id)
    if not article:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Article not found"}}
    return {"success": True, "data": article}


@router.get("/{article_id}/tickers")
async def get_article_tickers(article_id: int):
    article = await db.get_article_by_id(article_id)
    if not article:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Article not found"}}
    return {"success": True, "data": article.get("article_tickers", [])}
