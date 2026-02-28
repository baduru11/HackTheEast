import json

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.services.finnhub import fetch_quotes_for_tickers
from app.services.finnhub_ws import finnhub_proxy

router = APIRouter(prefix="/api/v1/market", tags=["market"])

YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Origin": "https://finance.yahoo.com",
    "Referer": "https://finance.yahoo.com/",
}


async def fetch_yahoo_quotes(symbols: list[str]) -> list[dict]:
    """Fetch real index quotes from Yahoo Finance (supports ^GSPC, ^DJI, etc.)."""
    results = []
    async with httpx.AsyncClient(timeout=15, headers=YAHOO_HEADERS, follow_redirects=True) as client:
        for symbol in symbols:
            try:
                res = await client.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                    params={"interval": "1d", "range": "1d"},
                )
                if res.status_code != 200:
                    print(f"Yahoo Finance {symbol}: HTTP {res.status_code}")
                    continue
                data = res.json()
                result_list = (data.get("chart", {}).get("result") or [])
                if not result_list:
                    print(f"Yahoo Finance {symbol}: empty result")
                    continue
                meta = result_list[0].get("meta", {})
                price = meta.get("regularMarketPrice")
                if price is not None:
                    prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")
                    pct = ((price - prev_close) / prev_close * 100) if prev_close else None
                    results.append({
                        "ticker": symbol,
                        "price": price,
                        "price_change_pct": round(pct, 4) if pct is not None else None,
                    })
                else:
                    print(f"Yahoo Finance {symbol}: no price in meta")
            except Exception as e:
                print(f"Yahoo Finance error ({symbol}): {e}")
    return results


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
