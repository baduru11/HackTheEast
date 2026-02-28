from fastapi import APIRouter, Depends, Query

from app.db import supabase as db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/articles", tags=["articles"])


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
async def debug_process():
    """Manually trigger pipeline processing for debugging."""
    import traceback
    from app.services.pipeline import process_pending_articles, recover_stuck_articles
    results = {"recover": None, "process": None, "error": None}
    try:
        await recover_stuck_articles()
        results["recover"] = "ok"
    except Exception as e:
        results["recover"] = f"{e}"
    try:
        await process_pending_articles(batch_size=2)
        results["process"] = "ok"
    except Exception as e:
        results["process"] = f"{e}"
        results["error"] = traceback.format_exc()
    return results


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
