from fastapi import APIRouter, Query

from app.db import supabase as db

router = APIRouter(prefix="/api/v1/articles", tags=["articles"])


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
