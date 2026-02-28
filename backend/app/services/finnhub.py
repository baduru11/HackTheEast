import finnhub
import httpx
from datetime import datetime, timedelta

from app.config import settings

client = finnhub.Client(api_key=settings.finnhub_api_key)

TOP_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B",
    "JPM", "V", "JNJ", "WMT", "PG", "MA", "UNH", "HD", "DIS", "BAC",
    "XOM", "NFLX",
]

NEWS_CATEGORIES = ["general", "forex", "crypto", "merger"]

PAYWALLED_SOURCES = {"MarketWatch", "SeekingAlpha", "Bloomberg", "Barron's", "WSJ", "Financial Times"}

# Sources where Finnhub proxies/hides the real URL (returns finnhub.io links)
BROKEN_URL_SOURCES = {"Yahoo", "Motley Fool", "Business Insider", "Forbes", "ChartMill", "Benzinga"}

BLOCKED_SOURCES = PAYWALLED_SOURCES | BROKEN_URL_SOURCES

BROKEN_IMAGE_PATTERNS = ["s.yimg.com", "media.zenfs.com", "static.finnhub.io", "static2.finnhub.io"]


def clean_image_url(url: str | None) -> str | None:
    """Return None for known-broken image URLs."""
    if not url or not url.strip():
        return None
    if any(p in url for p in BROKEN_IMAGE_PATTERNS):
        return None
    return url


async def fetch_general_news() -> list[dict]:
    """Fetch general market news from all categories."""
    articles = []
    for category in NEWS_CATEGORIES:
        try:
            news = client.general_news(category, min_id=0)
            for item in news:
                if item.get("source", "") in BLOCKED_SOURCES:
                    continue
                url = item.get("url", "")
                if not url or "finnhub.io" in url:
                    continue
                articles.append({
                    "finnhub_id": str(item.get("id")),
                    "headline": item.get("headline", ""),
                    "snippet": item.get("summary", ""),
                    "source_name": item.get("source", ""),
                    "original_url": item.get("url", ""),
                    "image_url": clean_image_url(item.get("image")),
                    "published_at": datetime.fromtimestamp(item.get("datetime", 0)).isoformat(),
                    "category": category,
                })
        except Exception as e:
            print(f"Finnhub general_news error ({category}): {e}")
    return articles


async def fetch_company_news(ticker: str) -> list[dict]:
    """Fetch news for a specific company ticker."""
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=7)
    try:
        news = client.company_news(ticker, _from=str(week_ago), to=str(today))
        results = []
        for item in news[:10]:
            if item.get("source", "") in BLOCKED_SOURCES:
                continue
            url = item.get("url", "")
            if not url or "finnhub.io" in url:
                continue
            results.append({
                "finnhub_id": str(item.get("id")),
                "headline": item.get("headline", ""),
                "snippet": item.get("summary", ""),
                "source_name": item.get("source", ""),
                "original_url": url,
                "image_url": clean_image_url(item.get("image")),
                "published_at": datetime.fromtimestamp(item.get("datetime", 0)).isoformat(),
                "tickers": [ticker],
            })
            if len(results) >= 5:
                break
        return results
    except Exception as e:
        print(f"Finnhub company_news error ({ticker}): {e}")
        return []


async def fetch_quote(ticker: str) -> dict | None:
    """Fetch current price quote for a ticker."""
    try:
        quote = client.quote(ticker)
        return {
            "ticker": ticker,
            "price": quote.get("c"),  # current price
            "price_change_pct": quote.get("dp"),  # percent change
        }
    except Exception as e:
        print(f"Finnhub quote error ({ticker}): {e}")
        return None


async def fetch_all_news() -> list[dict]:
    """Fetch news from all sources: general + top tickers."""
    articles = await fetch_general_news()

    for ticker in TOP_TICKERS:
        company_articles = await fetch_company_news(ticker)
        articles.extend(company_articles)

    return articles


async def fetch_quotes_for_tickers(tickers: list[str]) -> list[dict]:
    """Fetch quotes for a list of tickers."""
    quotes = []
    for ticker in tickers:
        quote = await fetch_quote(ticker)
        if quote:
            quotes.append(quote)
    return quotes
