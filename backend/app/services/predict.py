import random
import logging
from datetime import date

from app.db import supabase as db
from app.services import finnhub

logger = logging.getLogger(__name__)


async def get_or_create_daily_stocks() -> dict:
    today = date.today().isoformat()

    existing = await db.get_daily_stocks(today)
    if existing:
        return existing

    # Get active pool and randomly select 5
    pool = await db.get_active_stock_pool()
    if len(pool) < 5:
        raise ValueError("Not enough stocks in pool")

    selected = random.sample(pool, 5)
    tickers = [s["ticker"] for s in selected]

    record = await db.insert_daily_stocks(today, tickers)
    return record


async def get_today_stocks_with_prices() -> list[dict]:
    daily = await get_or_create_daily_stocks()
    tickers = daily["tickers"]

    pool = await db.get_active_stock_pool()
    ticker_names = {s["ticker"]: s["name"] for s in pool}

    stocks = []
    for ticker in tickers:
        try:
            quote = await finnhub.get_quote(ticker)
            stocks.append({
                "ticker": ticker,
                "name": ticker_names.get(ticker, ticker),
                "price": quote.get("c", 0),
                "change_24h": quote.get("dp", 0),
            })
        except Exception as e:
            logger.warning(f"Failed to fetch quote for {ticker}: {e}")
            stocks.append({
                "ticker": ticker,
                "name": ticker_names.get(ticker, ticker),
                "price": 0,
                "change_24h": 0,
            })

    return stocks


async def resolve_pending_predictions():
    pending = await db.get_pending_predictions()
    if not pending:
        logger.info("No pending predictions to resolve")
        return

    # Group by ticker to minimize API calls
    tickers = list({p["ticker"] for p in pending})
    closing_prices = {}
    for ticker in tickers:
        try:
            quote = await finnhub.get_quote(ticker)
            closing_prices[ticker] = quote.get("c", 0)
        except Exception as e:
            logger.error(f"Failed to fetch closing price for {ticker}: {e}")

    resolved_count = 0
    for pred in pending:
        ticker = pred["ticker"]
        if ticker not in closing_prices or closing_prices[ticker] == 0:
            continue

        close_price = closing_prices[ticker]
        bet_price = float(pred["price_at_bet"])

        if pred["direction"] == "up":
            won = close_price > bet_price
        else:
            won = close_price < bet_price

        result = "win" if won else "loss"
        xp = 50 if won else 0

        await db.resolve_prediction(pred["id"], close_price, result, xp)

        if xp > 0:
            await db.add_xp(pred["user_id"], xp)

        resolved_count += 1

    logger.info(f"Resolved {resolved_count} predictions")
