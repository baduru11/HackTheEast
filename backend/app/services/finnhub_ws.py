import asyncio
import json

import websockets

from app.config import settings


class FinnhubWSProxy:
    """Maintains a single upstream Finnhub WebSocket, broadcasts trades to all connected clients."""

    def __init__(self):
        self.clients: set = set()
        self._upstream = None
        self._task: asyncio.Task | None = None
        self._symbols: set[str] = set()
        self._lock = asyncio.Lock()

    async def add_client(self, ws):
        self.clients.add(ws)

    def remove_client(self, ws):
        self.clients.discard(ws)
        if not self.clients and self._task:
            self._task.cancel()
            self._task = None
            self._upstream = None
            self._symbols.clear()

    async def subscribe(self, symbol: str):
        async with self._lock:
            if symbol in self._symbols:
                return
            self._symbols.add(symbol)
            if not self._task or self._task.done():
                self._task = asyncio.create_task(self._run_upstream())
            elif self._upstream:
                try:
                    await self._upstream.send(json.dumps({"type": "subscribe", "symbol": symbol}))
                except Exception:
                    pass

    async def unsubscribe(self, symbol: str):
        async with self._lock:
            self._symbols.discard(symbol)
            if self._upstream:
                try:
                    await self._upstream.send(json.dumps({"type": "unsubscribe", "symbol": symbol}))
                except Exception:
                    pass

    async def _run_upstream(self):
        uri = f"wss://ws.finnhub.io?token={settings.finnhub_api_key}"
        try:
            async with websockets.connect(uri) as ws:
                self._upstream = ws
                for symbol in self._symbols:
                    await ws.send(json.dumps({"type": "subscribe", "symbol": symbol}))

                async for message in ws:
                    dead = []
                    for client in self.clients:
                        try:
                            await client.send_text(message)
                        except Exception:
                            dead.append(client)
                    for d in dead:
                        self.clients.discard(d)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Finnhub upstream WS error: {e}")
            if self.clients:
                await asyncio.sleep(5)
                self._task = asyncio.create_task(self._run_upstream())
        finally:
            self._upstream = None


finnhub_proxy = FinnhubWSProxy()
