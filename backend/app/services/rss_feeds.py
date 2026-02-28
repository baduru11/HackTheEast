import re
from datetime import datetime, timezone
from html import unescape

import feedparser
import httpx

RSS_SOURCES = [
    {"name": "Reuters Business", "url": "https://www.reutersagency.com/feed/?best-topics=business-finance"},
    {"name": "CNBC Top News", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"},
    {"name": "CNBC World", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362"},
    {"name": "BBC Business", "url": "https://feeds.bbci.co.uk/news/business/rss.xml"},
    {"name": "AP News Business", "url": "https://rsshub.app/apnews/topics/business"},
    {"name": "The Guardian Business", "url": "https://www.theguardian.com/uk/business/rss"},
    {"name": "Investing.com News", "url": "https://www.investing.com/rss/news.rss"},
    {"name": "Investing.com Analysis", "url": "https://www.investing.com/rss/news_301.rss"},
]

MAX_ARTICLES_PER_FEED = 15

_STRIP_HTML = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    """Remove HTML tags and decode entities."""
    return unescape(_STRIP_HTML.sub("", text)).strip()


def _parse_published(entry) -> str | None:
    """Extract published datetime as ISO string."""
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if parsed:
        try:
            return datetime(*parsed[:6], tzinfo=timezone.utc).isoformat()
        except Exception:
            pass
    return None


def _extract_image(entry) -> str | None:
    """Extract image URL from media tags or enclosures."""
    # media:thumbnail or media:content
    for media in entry.get("media_thumbnail", []):
        if media.get("url"):
            return media["url"]
    for media in entry.get("media_content", []):
        if media.get("url") and "image" in media.get("type", "image"):
            return media["url"]
    # enclosures
    for enc in entry.get("enclosures", []):
        if enc.get("type", "").startswith("image"):
            return enc.get("href") or enc.get("url")
    return None


async def fetch_single_feed(source: dict) -> list[dict]:
    """Fetch and parse a single RSS feed, returning article dicts."""
    articles = []
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            headers = {"User-Agent": "HackTheEast/1.0 NewsBot"}
            resp = await client.get(source["url"], headers=headers)
            resp.raise_for_status()

        feed = feedparser.parse(resp.text)

        for entry in feed.entries[:MAX_ARTICLES_PER_FEED]:
            link = entry.get("link", "")
            headline = entry.get("title", "")
            if not link or not headline:
                continue

            snippet_raw = entry.get("summary", "") or entry.get("description", "")
            snippet = _strip_html(snippet_raw)[:500] if snippet_raw else ""

            articles.append({
                "headline": headline.strip(),
                "snippet": snippet,
                "original_url": link.strip(),
                "image_url": _extract_image(entry),
                "published_at": _parse_published(entry),
                "source_name": source["name"],
            })
    except Exception as e:
        print(f"RSS feed error ({source['name']}): {e}")

    return articles


async def fetch_all_rss_feeds() -> list[dict]:
    """Fetch all RSS feeds and return combined article list."""
    all_articles = []
    for source in RSS_SOURCES:
        articles = await fetch_single_feed(source)
        all_articles.extend(articles)
    print(f"RSS feeds: fetched {len(all_articles)} articles from {len(RSS_SOURCES)} sources")
    return all_articles
