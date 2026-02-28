import json

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.services.finnhub import fetch_quotes_for_tickers
from app.services.finnhub_ws import finnhub_proxy

router = APIRouter(prefix="/api/v1/market", tags=["market"])

YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}


async def fetch_yahoo_quotes(symbols: list[str]) -> list[dict]:
    """Fetch real index quotes from Yahoo Finance (supports ^GSPC, ^DJI, etc.)."""
    joined = ",".join(symbols)
    url = f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={joined}"
    try:
        async with httpx.AsyncClient(timeout=10, headers=YAHOO_HEADERS) as client:
            res = await client.get(url)
            res.raise_for_status()
            data = res.json()
        results = []
        for q in data.get("quoteResponse", {}).get("result", []):
            results.append({
                "ticker": q.get("symbol"),
                "price": q.get("regularMarketPrice"),
                "price_change_pct": q.get("regularMarketChangePercent"),
            })
        return results
    except Exception as e:
        print(f"Yahoo Finance quotes error: {e}")
        return []


@router.get("/quotes")
async def get_quotes(
    symbols: str = Query(..., description="Comma-separated ticker symbols"),
):
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()][:20]

    index_symbols = [s for s in symbol_list if s.startswith("^")]
    stock_symbols = [s.upper() for s in symbol_list if not s.startswith("^")]

    quotes = []
    if index_symbols:
        quotes += await fetch_yahoo_quotes(index_symbols)
    if stock_symbols:
        quotes += await fetch_quotes_for_tickers(stock_symbols)

    return {"data": quotes}


@router.websocket("/ws")
async def market_ws(ws: WebSocket):
    await ws.accept()
    await finnhub_proxy.add_client(ws)
    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "subscribe" and msg.get("symbol"):
                await finnhub_proxy.subscribe(msg["symbol"])
            elif msg.get("type") == "unsubscribe" and msg.get("symbol"):
                await finnhub_proxy.unsubscribe(msg["symbol"])
    except WebSocketDisconnect:
        finnhub_proxy.remove_client(ws)
    except Exception:
        finnhub_proxy.remove_client(ws)
