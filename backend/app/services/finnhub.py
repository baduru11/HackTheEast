import asyncio
import finnhub
import httpx
from datetime import datetime, timedelta, timezone

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

# Press releases / wire services (not real journalism, clutters feed)
WIRE_SOURCES = {"GlobalNewswire", "BusinessWire", "PR Newswire", "GlobeNewsWire", "Cryptocurrency News"}

BLOCKED_SOURCES = PAYWALLED_SOURCES | BROKEN_URL_SOURCES | WIRE_SOURCES

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
    loop = asyncio.get_event_loop()
    articles = []
    for category in NEWS_CATEGORIES:
        try:
            news = await loop.run_in_executor(None, lambda c=category: client.general_news(c, min_id=0))
            for item in news:
                if item.get("source", "") in BLOCKED_SOURCES:
                    continue
                url = item.get("url", "")
                if not url or "finnhub.io" in url:
                    continue
                ts = item.get("datetime", 0)
                if not ts or ts <= 0:
                    continue
                articles.append({
                    "finnhub_id": str(item.get("id")),
                    "headline": item.get("headline", ""),
                    "snippet": item.get("summary", ""),
                    "source_name": item.get("source", ""),
                    "original_url": item.get("url", ""),
                    "image_url": clean_image_url(item.get("image")),
                    "published_at": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(),
                    "category": category,
                })
        except Exception as e:
            print(f"Finnhub general_news error ({category}): {e}")
    return articles


async def fetch_company_news(ticker: str) -> list[dict]:
    """Fetch news for a specific company ticker."""
    loop = asyncio.get_event_loop()
    today = datetime.now(timezone.utc).date()
    week_ago = today - timedelta(days=7)
    try:
        news = await loop.run_in_executor(None, lambda: client.company_news(ticker, _from=str(week_ago), to=str(today)))
        results = []
        for item in news[:10]:
            if item.get("source", "") in BLOCKED_SOURCES:
                continue
            url = item.get("url", "")
            if not url or "finnhub.io" in url:
                continue
            ts = item.get("datetime", 0)
            if not ts or ts <= 0:
                continue
            results.append({
                "finnhub_id": str(item.get("id")),
                "headline": item.get("headline", ""),
                "snippet": item.get("summary", ""),
                "source_name": item.get("source", ""),
                "original_url": url,
                "image_url": clean_image_url(item.get("image")),
                "published_at": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(),
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
    loop = asyncio.get_event_loop()
    try:
        quote = await loop.run_in_executor(None, lambda: client.quote(ticker))
        return {
            "ticker": ticker,
            "price": quote.get("c"),  # current price
            "price_change_pct": quote.get("dp"),  # percent change
        }
    except Exception as e:
        print(f"Finnhub quote error ({ticker}): {e}")
        return None


async def fetch_all_news() -> list[dict]:
    """Fetch news from all sources: general + top tickers in parallel."""
    general, *company_results = await asyncio.gather(
        fetch_general_news(),
        *[fetch_company_news(ticker) for ticker in TOP_TICKERS],
    )
    articles = general
    for result in company_results:
        articles.extend(result)
    return articles


async def fetch_quotes_for_tickers(tickers: list[str]) -> list[dict]:
    """Fetch quotes for a list of tickers."""
    quotes = []
    for ticker in tickers:
        quote = await fetch_quote(ticker)
        if quote:
            quotes.append(quote)
    return quotes


async def get_quote(symbol: str) -> dict:
    """Fetch real-time quote for a single symbol."""
    async with httpx.AsyncClient() as http:
        resp = await http.get(
            "https://finnhub.io/api/v1/quote",
            params={"symbol": symbol, "token": settings.finnhub_api_key},
        )
        resp.raise_for_status()
        return resp.json()


async def get_candles(symbol: str, resolution: str, from_ts: int, to_ts: int) -> dict:
    """Fetch candle data for charting. Uses the SDK for consistency with other endpoints."""
    loop = asyncio.get_event_loop()
    try:
        data = await loop.run_in_executor(
            None,
            lambda: client.stock_candles(symbol, resolution, from_ts, to_ts),
        )
    except Exception as e:
        raise RuntimeError(f"Finnhub candle API error for {symbol}: {e}")

    if not data or data.get("s") == "no_data":
        raise ValueError(f"No candle data available for {symbol}")
    return data
