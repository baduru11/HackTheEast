import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.services.finnhub import fetch_quotes_for_tickers
from app.services.finnhub_ws import finnhub_proxy

router = APIRouter(prefix="/api/v1/market", tags=["market"])


@router.get("/quotes")
async def get_quotes(
    symbols: str = Query(..., description="Comma-separated ticker symbols"),
):
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()][:20]
    quotes = await fetch_quotes_for_tickers(symbol_list)
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
