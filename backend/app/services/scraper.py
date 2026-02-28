import asyncio
import re
from concurrent.futures import ThreadPoolExecutor

import httpx
import trafilatura

executor = ThreadPoolExecutor(max_workers=4)


def _extract_og_image(html: str) -> str | None:
    """Extract og:image from HTML meta tags."""
    match = re.search(
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        html, re.IGNORECASE,
    )
    if not match:
        match = re.search(
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
            html, re.IGNORECASE,
        )
    return match.group(1) if match else None


def _extract_article(html: str) -> dict | None:
    """Synchronous trafilatura extraction (runs in thread pool)."""
    result = trafilatura.extract(
        html,
        no_fallback=False,
        favor_precision=False,
        favor_recall=True,
        include_comments=False,
        include_tables=False,
        output_format="json",
        with_metadata=True,
    )
    if result:
        import json
        parsed = json.loads(result)
        if not parsed.get("image"):
            parsed["image"] = _extract_og_image(html)
        return parsed

    # Fallback: try to get og:image even if extraction fails
    return None


async def scrape_article(url: str) -> dict | None:
    """Scrape a single article URL and extract content."""
    try:
        # Block internal/private network URLs to prevent SSRF
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if not parsed.hostname or parsed.hostname in ("localhost", "127.0.0.1", "0.0.0.0") or parsed.hostname.startswith("192.168.") or parsed.hostname.startswith("10.") or parsed.hostname.startswith("172."):
            print(f"Scraper blocked internal URL: {url}")
            return None
        async with httpx.AsyncClient(
            timeout=30,
            follow_redirects=True,
            max_redirects=5,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            html = response.text

        final_url = str(response.url)

        loop = asyncio.get_event_loop()
        extracted = await loop.run_in_executor(executor, _extract_article, html)

        # Attach og:image even if trafilatura didn't find one
        if extracted and not extracted.get("image"):
            extracted["image"] = _extract_og_image(html)

        # If extraction failed entirely, return minimal data with og:image
        if not extracted:
            og_image = _extract_og_image(html)
            return {"text": None, "image": og_image, "final_url": final_url}

        extracted["final_url"] = final_url
        return extracted
    except Exception as e:
        print(f"Scraper error ({url}): {e}")
        return None


async def scrape_batch(urls: list[str]) -> list[dict | None]:
    """Scrape multiple URLs in parallel."""
    tasks = [scrape_article(url) for url in urls]
    return await asyncio.gather(*tasks, return_exceptions=True)
