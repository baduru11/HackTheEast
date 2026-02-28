import httpx
from datetime import datetime

from app.config import settings

GNEWS_SEARCH_URL = "https://gnews.io/api/v4/search"
GNEWS_TOP_URL = "https://gnews.io/api/v4/top-headlines"

# World sector queries
REGION_QUERIES = {
    "asia": "asia finance OR economy",
    "europe": "europe finance OR economy",
    "india": "india finance OR economy",
    "china": "china finance OR economy",
    "japan": "japan finance OR economy",
    "americas": "americas finance OR economy",
    "war": "war sanctions economy impact",
}

# Markets sector queries — fills the gap left by blocked Finnhub sources
MARKET_QUERIES = {
    "stocks": "stock market OR earnings OR S&P 500",
    "bonds": "bonds OR treasury OR yield OR fixed income",
    "currency": "forex OR dollar OR currency exchange rate",
    "etfs": "ETF OR index fund OR Vanguard OR BlackRock",
    "options": "options trading OR derivatives OR calls puts",
    "sector": "sector rotation OR energy stocks OR tech stocks",
    "indices": "Dow Jones OR Nasdaq OR FTSE OR Nikkei",
}


async def _fetch_gnews(query: str, slug: str, use_top: bool = False) -> list[dict]:
    """Generic GNews fetch for search or top headlines."""
    url = GNEWS_TOP_URL if use_top else GNEWS_SEARCH_URL
    params = {
        "lang": "en",
        "max": 10,
        "apikey": settings.gnews_api_key,
    }
    if not use_top:
        params["q"] = query

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, params=params)
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
                "region": slug,
            })
        return articles
    except Exception as e:
        print(f"GNews error ({slug}): {e}")
        return []


async def fetch_region_news(region_slug: str) -> list[dict]:
    """Fetch news for a specific region/topic."""
    query = REGION_QUERIES.get(region_slug)
    if not query:
        return []
    return await _fetch_gnews(query, region_slug)


async def fetch_market_news(market_slug: str) -> list[dict]:
    """Fetch news for a specific market sector."""
    query = MARKET_QUERIES.get(market_slug)
    if not query:
        return []
    return await _fetch_gnews(query, market_slug)


async def fetch_all_regions() -> list[dict]:
    """Fetch news from all world regions."""
    all_articles = []
    for slug in REGION_QUERIES:
        articles = await fetch_region_news(slug)
        all_articles.extend(articles)
    return all_articles


async def fetch_all_markets() -> list[dict]:
    """Fetch news for market sectors not well covered by Finnhub."""
    all_articles = []
    for slug in MARKET_QUERIES:
        articles = await fetch_market_news(slug)
        all_articles.extend(articles)
    return all_articles
