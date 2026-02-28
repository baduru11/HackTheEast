import logging
from datetime import date
from fastapi import APIRouter, Depends
import httpx
from app.dependencies import get_current_user
from app.db import supabase as db
from app.models.predict import PredictionCreate
from app.services.predict import get_today_stocks_with_prices

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/predict", tags=["predict"])

YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}


@router.get("/today")
async def get_today():
    try:
        stocks = await get_today_stocks_with_prices()
    except ValueError as e:
        return {"success": False, "error": {"code": "NO_STOCKS", "message": str(e)}}

    return {
        "success": True,
        "data": {
            "date": date.today().isoformat(),
            "stocks": stocks,
        },
    }


@router.post("/predict")
async def place_prediction(
    body: PredictionCreate,
    user_id: str = Depends(get_current_user),
):
    today = date.today().isoformat()

    # Check if today's stock list includes this ticker
    daily = await db.get_daily_stocks(today)
    if not daily or body.ticker not in daily["tickers"]:
        return {"success": False, "error": {"code": "INVALID_TICKER", "message": "This stock is not in today's selection"}}

    # Check if already predicted this stock today
    existing = await db.get_user_prediction(user_id, today, body.ticker)
    if existing:
        return {"success": False, "error": {"code": "ALREADY_PREDICTED", "message": "You already predicted this stock today"}}

    prediction = await db.insert_prediction(user_id, today, body.ticker, body.direction, body.price_at_bet)

    return {
        "success": True,
        "data": prediction,
    }


@router.get("/my-predictions")
async def get_my_predictions(
    user_id: str = Depends(get_current_user),
    limit: int = 20,
):
    predictions = await db.get_user_predictions(user_id, limit)

    result = []
    for p in predictions:
        stock_name = p.get("stock_pool", {}).get("name", p["ticker"]) if p.get("stock_pool") else p["ticker"]
        result.append({
            "id": p["id"],
            "ticker": p["ticker"],
            "stock_name": stock_name,
            "direction": p["direction"],
            "price_at_bet": float(p["price_at_bet"]),
            "price_at_close": float(p["price_at_close"]) if p.get("price_at_close") else None,
            "result": p["result"],
            "xp_earned": p["xp_earned"],
            "created_at": p["created_at"],
        })

    return {"success": True, "data": result}


@router.get("/stock/{ticker}/candles")
async def get_stock_candles(ticker: str, range: str = "7D"):
    """Fetch chart data from Yahoo Finance (free, no API key needed)."""
    yahoo_params = {
        "1D": {"range": "1d", "interval": "5m"},
        "7D": {"range": "5d", "interval": "15m"},
        "30D": {"range": "1mo", "interval": "1h"},
        "90D": {"range": "3mo", "interval": "1d"},
    }

    if range not in yahoo_params:
        return {"success": False, "error": {"code": "INVALID_RANGE", "message": "Use 1D, 7D, 30D, or 90D"}}

    params = yahoo_params[range]

    try:
        async with httpx.AsyncClient(timeout=15, headers=YAHOO_HEADERS, follow_redirects=True) as client:
            resp = await client.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}",
                params=params,
            )
            if resp.status_code != 200:
                logger.warning(f"Yahoo chart {ticker}: HTTP {resp.status_code}")
                return {"success": False, "error": {"code": "FETCH_ERROR", "message": f"Yahoo Finance returned {resp.status_code}"}}

            data = resp.json()
            results = data.get("chart", {}).get("result") or []
            if not results:
                return {"success": False, "error": {"code": "NO_DATA", "message": f"No chart data for {ticker}"}}

            result = results[0]
            timestamps = result.get("timestamp") or []
            indicators = result.get("indicators", {}).get("quote", [{}])[0]
            closes = indicators.get("close") or []

            if not timestamps or not closes:
                return {"success": False, "error": {"code": "NO_DATA", "message": f"No price data for {ticker} ({range})"}}

            # Filter out null close prices (can happen during pre/post market)
            filtered_t = []
            filtered_c = []
            for t, c in zip(timestamps, closes):
                if c is not None:
                    filtered_t.append(t)
                    filtered_c.append(round(c, 2))

            if not filtered_t:
                return {"success": False, "error": {"code": "NO_DATA", "message": f"No trading data for {ticker} ({range})"}}

            # Return in same format as before (compatible with frontend)
            return {
                "success": True,
                "data": {
                    "t": filtered_t,
                    "c": filtered_c,
                    "s": "ok",
                },
            }
    except Exception as e:
        logger.error(f"Yahoo chart error {ticker}: {e}")
        return {"success": False, "error": {"code": "FETCH_ERROR", "message": str(e)}}
