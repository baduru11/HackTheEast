from app.db import supabase as db
from app.services import finnhub, gnews, scraper, llm


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


async def ingest_gnews():
    """Full GNews ingestion cycle: fetch all regions, deduplicate, save."""
    articles = await gnews.fetch_all_regions()
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

        # Map region to sector
        if region:
            sector = await db.get_sector_by_slug(region)
            if sector:
                await db.insert_article_sectors(article_id, [sector["id"]])

        saved_count += 1

    print(f"GNews ingestion: {saved_count} new articles saved")
    return saved_count


async def process_pending_articles(batch_size: int = 5):
    """Scrape and generate AI content for pending articles."""
    articles, _ = await db.get_articles(status="pending", page=1, limit=batch_size)

    for article in articles:
        article_id = article["id"]

        # Step 1: Scrape
        await db.update_article(article_id, {"processing_status": "scraping"})
        scraped = await scraper.scrape_article(article["original_url"])

        if not scraped:
            await db.update_article(article_id, {"processing_status": "failed"})
            continue

        raw_text = scraped.get("text", "")
        author = scraped.get("author")
        await db.update_article(article_id, {
            "raw_content": raw_text,
            "author": author,
            "processing_status": "generating",
        })

        # Step 2: LLM generate
        result = await llm.generate_article_content(article["headline"], raw_text)

        if not result:
            await db.update_article(article_id, {"processing_status": "failed"})
            continue

        # Save AI content
        await db.update_article(article_id, {
            "ai_summary": result.summary,
            "ai_tutorial": result.tutorial,
            "processing_status": "done",
        })

        # Save sectors
        if result.sectors:
            sectors = await db.get_all_sectors()
            sector_map = {s["slug"]: s["id"] for s in sectors}
            sector_ids = [sector_map[s] for s in result.sectors if s in sector_map]
            if sector_ids:
                # Check for existing sector mappings first
                existing = article.get("article_sectors", [])
                existing_ids = {s.get("sector_id") for s in existing} if existing else set()
                new_ids = [sid for sid in sector_ids if sid not in existing_ids]
                if new_ids:
                    await db.insert_article_sectors(article_id, new_ids)

        # Save quiz
        await db.insert_quiz(article_id, [q.model_dump() for q in result.questions])

        # Notify users who favorite these sectors
        await _notify_sector_users(article_id, article["headline"])

    print(f"Processed {len(articles)} articles")


async def _notify_sector_users(article_id: int, headline: str):
    """Send notifications to users who favorite the article's sectors."""
    article = await db.get_article_by_id(article_id)
    if not article:
        return

    sector_ids = [s["sector_id"] for s in article.get("article_sectors", [])]
    if not sector_ids:
        return

    all_favorites = await db.get_all_favorites_with_users()
    notified_users = set()

    for fav in all_favorites:
        if fav["sector_id"] in sector_ids and fav["user_id"] not in notified_users:
            await db.insert_notification(
                user_id=fav["user_id"],
                type="new_article",
                title="New article in your sector",
                body=headline[:200],
                link=f"/article/{article_id}",
            )
            notified_users.add(fav["user_id"])
