import httpx
from datetime import datetime

from app.config import settings

GNEWS_BASE_URL = "https://gnews.io/api/v4/search"

REGION_QUERIES = {
    "asia": "asia finance OR economy",
    "europe": "europe finance OR economy",
    "india": "india finance OR economy",
    "china": "china finance OR economy",
    "japan": "japan finance OR economy",
    "americas": "americas finance OR economy",
    "war": "war sanctions economy impact",
}


async def fetch_region_news(region_slug: str) -> list[dict]:
    """Fetch news for a specific region/topic."""
    query = REGION_QUERIES.get(region_slug)
    if not query:
        return []

    params = {
        "q": query,
        "lang": "en",
        "max": 10,
        "apikey": settings.gnews_api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(GNEWS_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()

        articles = []
        for item in data.get("articles", []):
            articles.append({
                "gnews_url": item.get("url", ""),
                "headline": item.get("title", ""),
                "snippet": item.get("description", ""),
                "source_name": item.get("source", {}).get("name", ""),
                "original_url": item.get("url", ""),
                "image_url": item.get("image"),
                "published_at": item.get("publishedAt"),
                "region": region_slug,
            })
        return articles
    except Exception as e:
        print(f"GNews error ({region_slug}): {e}")
        return []


async def fetch_all_regions() -> list[dict]:
    """Fetch news from all configured regions."""
    all_articles = []
    for slug in REGION_QUERIES:
        articles = await fetch_region_news(slug)
        all_articles.extend(articles)
    return all_articles
