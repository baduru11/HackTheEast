import asyncio
from urllib.parse import urlparse

import httpx

from app.db import supabase as db
from app.services import finnhub, gnews, rss_feeds, scraper, llm

DOMAIN_TO_SOURCE = {
    "fool.com": "Motley Fool",
    "benzinga.com": "Benzinga",
    "investorplace.com": "InvestorPlace",
    "barrons.com": "Barron's",
    "wsj.com": "WSJ",
    "ft.com": "Financial Times",
    "bloomberg.com": "Bloomberg",
    "reuters.com": "Reuters",
    "cnbc.com": "CNBC",
    "bbc.co.uk": "BBC",
    "bbc.com": "BBC",
    "theguardian.com": "The Guardian",
    "apnews.com": "AP News",
    "businessinsider.com": "Business Insider",
    "techcrunch.com": "TechCrunch",
    "cointelegraph.com": "Cointelegraph",
    "coindesk.com": "CoinDesk",
    "marketwatch.com": "MarketWatch",
    "seekingalpha.com": "SeekingAlpha",
    "investing.com": "Investing.com",
    "thestreet.com": "TheStreet",
    "nytimes.com": "NY Times",
}


def _source_from_domain(url: str) -> str | None:
    """Extract a friendly source name from a URL's domain."""
    try:
        host = urlparse(url).hostname or ""
        host = host.lower().removeprefix("www.")
        for domain, name in DOMAIN_TO_SOURCE.items():
            if host == domain or host.endswith("." + domain):
                return name
    except Exception:
        pass
    return None


async def resolve_url(url: str) -> tuple[str, str | None]:
    """Follow redirects and return (final_url, source_name_or_None)."""
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.head(url)
            final = str(resp.url)
            return final, _source_from_domain(final)
    except Exception:
        return url, None


async def ingest_finnhub():
    """Full Finnhub ingestion cycle: fetch news, deduplicate, save."""
    articles = await finnhub.fetch_all_news()
    saved_count = 0

    for article in articles:
        if await db.article_exists(finnhub_id=article.get("finnhub_id"), original_url=article.get("original_url")):
            continue

        article_id = await db.insert_article({
            "finnhub_id": article.get("finnhub_id"),
            "source_name": article.get("source_name", ""),
            "headline": article.get("headline", ""),
            "snippet": article.get("snippet"),
            "original_url": article.get("original_url", ""),
            "image_url": article.get("image_url"),
            "published_at": article.get("published_at"),
            "processing_status": "pending",
        })

        # Fetch and attach ticker quotes if available
        tickers = article.get("tickers", [])
        if tickers:
            quotes = await finnhub.fetch_quotes_for_tickers(tickers)
            if quotes:
                await db.insert_article_tickers(article_id, quotes)

        saved_count += 1

    print(f"Finnhub ingestion: {saved_count} new articles saved")
    return saved_count


async def _ingest_gnews_articles(articles: list[dict], label: str) -> int:
    """Shared GNews ingestion logic for both regions and markets."""
    saved_count = 0

    for article in articles:
        if await db.article_exists(gnews_url=article.get("gnews_url"), original_url=article.get("original_url")):
            continue

        region = article.pop("region", None)
        article_id = await db.insert_article({
            "gnews_url": article.get("gnews_url"),
            "source_name": article.get("source_name", ""),
            "headline": article.get("headline", ""),
            "snippet": article.get("snippet"),
            "original_url": article.get("original_url", ""),
            "image_url": article.get("image_url"),
            "published_at": article.get("published_at"),
            "processing_status": "pending",
        })

        # Map region/market slug to sector
        if region:
            sector = await db.get_sector_by_slug(region)
            if sector:
                await db.insert_article_sectors(article_id, [sector["id"]])

        saved_count += 1

    print(f"GNews {label}: {saved_count} new articles saved")
    return saved_count


async def ingest_gnews_regions():
    """GNews ingestion: world/region queries (7 calls)."""
    articles = await gnews.fetch_all_regions()
    return await _ingest_gnews_articles(articles, "regions")


async def ingest_gnews_markets():
    """GNews ingestion: market sector queries (7 calls)."""
    articles = await gnews.fetch_all_markets()
    return await _ingest_gnews_articles(articles, "markets")


async def ingest_gnews():
    """Full GNews ingestion: both regions and markets."""
    await ingest_gnews_regions()
    await ingest_gnews_markets()


async def ingest_rss():
    """Full RSS ingestion cycle: fetch all feeds, deduplicate, save."""
    articles = await rss_feeds.fetch_all_rss_feeds()
    saved_count = 0

    for article in articles:
        if await db.article_exists(original_url=article.get("original_url")):
            continue

        await db.insert_article({
            "source_name": article.get("source_name", ""),
            "headline": article.get("headline", ""),
            "snippet": article.get("snippet"),
            "original_url": article.get("original_url", ""),
            "image_url": article.get("image_url"),
            "published_at": article.get("published_at"),
            "processing_status": "pending",
        })

        saved_count += 1

    print(f"RSS ingestion: {saved_count} new articles saved")
    return saved_count


async def recover_stuck_articles():
    """Reset articles stuck in scraping/generating for more than 10 minutes."""
    from datetime import datetime, timedelta, timezone

    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()

    for status in ("scraping", "generating"):
        stuck, _ = await db.get_articles(status=status, page=1, limit=50)
        recovered = 0
        for article in stuck:
            updated = article.get("updated_at") or article.get("created_at", "")
            if updated and updated < cutoff:
                await db.update_article(article["id"], {"processing_status": "pending"})
                recovered += 1
        if recovered:
            print(f"Recovered {recovered} articles stuck in '{status}'")


async def _process_single_article(article: dict) -> bool:
    """Process a single article. Returns True on success, False on failure."""
    article_id = article["id"]
    try:
        existing_content = article.get("raw_content")

        # Step 1: Scrape — skip if article already has content (retry of LLM-failed article)
        if existing_content and len(existing_content) >= 20:
            raw_text = existing_content
            await db.update_article(article_id, {"processing_status": "generating"})
        else:
            await db.update_article(article_id, {"processing_status": "scraping"})
            scraped = await scraper.scrape_article(article["original_url"])

            raw_text = scraped.get("text", "") if scraped else ""
            og_image = scraped.get("image") if scraped else None
            author = scraped.get("author") if scraped else None
            final_url = scraped.get("final_url") if scraped else None

            # Update URL and source name if redirect resolved to a different domain
            if final_url and final_url != article["original_url"]:
                real_source = _source_from_domain(final_url)
                updates = {"original_url": final_url}
                if real_source:
                    updates["source_name"] = real_source
                await db.update_article(article_id, updates)

            # Update image if we got a better one from og:image
            if og_image and og_image != article.get("image_url"):
                await db.update_article(article_id, {"image_url": og_image})

            # Skip articles with no image at all
            if not og_image and not article.get("image_url"):
                await db.update_article(article_id, {"processing_status": "failed"})
                return False

            # Fall back to snippet if scraping failed or got too little text
            if not raw_text or len(raw_text) < 100:
                raw_text = article.get("snippet", "")

            # Ultimate fallback: use headline (some RSS feeds like Investing.com have no description)
            if not raw_text or len(raw_text) < 30:
                raw_text = article.get("headline", "")

            if not raw_text or len(raw_text) < 20:
                await db.update_article(article_id, {"processing_status": "failed"})
                return False

            await db.update_article(article_id, {
                "raw_content": raw_text,
                "author": author,
                "processing_status": "generating",
            })

        # Step 2: LLM generate lesson
        result = await llm.generate_lesson(article["headline"], raw_text)

        if not result:
            await db.update_article(article_id, {"processing_status": "failed"})
            return False

        # Save AI content
        await db.update_article(article_id, {
            "ai_summary": result.summary,
            "ai_tutorial": None,
            "lesson_data": result.model_dump(),
            "processing_status": "done",
        })

        # Save sectors
        if result.sectors:
            sectors = await db.get_all_sectors()
            sector_map = {s["slug"]: s["id"] for s in sectors}
            sector_ids = [sector_map[s] for s in result.sectors if s in sector_map]
            if sector_ids:
                existing = article.get("article_sectors", [])
                existing_ids = {s.get("sector_id") for s in existing} if existing else set()
                new_ids = [sid for sid in sector_ids if sid not in existing_ids]
                if new_ids:
                    await db.insert_article_sectors(article_id, new_ids)

        # Save quiz (6 questions with question_type)
        quiz_rows = [
            {
                "question": q.prompt,
                "options": q.options,
                "correct_index": q.correct_index,
                "explanation": q.explanation,
                "question_type": q.type,
            }
            for q in result.quiz
        ]
        await db.insert_quiz(article_id, quiz_rows)

        # Notify users who favorite these sectors
        await _notify_sector_users(article_id, article["headline"])
        return True

    except Exception as e:
        print(f"Pipeline error for article {article_id}: {e}")
        try:
            await db.update_article(article_id, {"processing_status": "failed"})
        except Exception:
            pass
        return False


async def process_pending_articles(batch_size: int = 10):
    """Scrape and generate AI content for pending articles in parallel."""
    articles, _ = await db.get_articles(status="pending", page=1, limit=batch_size)
    if not articles:
        return

    results = await asyncio.gather(
        *[_process_single_article(a) for a in articles],
        return_exceptions=True,
    )

    done = sum(1 for r in results if r is True)
    failed = len(results) - done
    print(f"Processed {len(articles)} articles: {done} done, {failed} failed")


async def _notify_sector_users(article_id: int, headline: str):
    """Send notifications to users who favorite the article's sectors."""
    article = await db.get_article_by_id(article_id)
    if not article:
        return

    article_sectors = article.get("article_sectors", [])
    sector_ids = [s["sector_id"] for s in article_sectors]
    if not sector_ids:
        return

    # Build sector_id -> name lookup
    sector_names = {}
    for s in article_sectors:
        sec = s.get("sectors")
        if sec:
            sector_names[s["sector_id"]] = sec.get("name", "")

    all_favorites = await db.get_all_favorites_with_users()

    # Group by user: collect all matching sector names per user
    user_sectors: dict[str, list[str]] = {}
    for fav in all_favorites:
        if fav["sector_id"] in sector_ids:
            uid = fav["user_id"]
            name = sector_names.get(fav["sector_id"], "")
            if uid not in user_sectors:
                user_sectors[uid] = []
            if name:
                user_sectors[uid].append(name)

    for uid, names in user_sectors.items():
        sector_label = ", ".join(names[:3]) if names else "your sector"
        await db.insert_notification(
            user_id=uid,
            type="new_article",
            title=f"New in {sector_label}",
            body=headline[:200],
            link=f"/article/{article_id}",
        )
