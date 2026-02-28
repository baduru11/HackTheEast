import time
from datetime import date
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.db import supabase as db
from app.models.predict import PredictionCreate
from app.services.predict import get_today_stocks_with_prices
from app.services import finnhub

router = APIRouter(prefix="/api/v1/predict", tags=["predict"])


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
async def get_stock_candles(ticker: str, range: str = "1D"):
    now = int(time.time())

    resolution_map = {
        "1D": ("5", 86400),
        "7D": ("15", 604800),
        "30D": ("60", 2592000),
        "90D": ("D", 7776000),
    }

    if range not in resolution_map:
        return {"success": False, "error": {"code": "INVALID_RANGE", "message": "Use 1D, 7D, 30D, or 90D"}}

    resolution, seconds = resolution_map[range]
    from_ts = now - seconds

    try:
        candles = await finnhub.get_candles(ticker, resolution, from_ts, now)
        return {"success": True, "data": candles}
    except Exception as e:
        return {"success": False, "error": {"code": "FETCH_ERROR", "message": str(e)}}
