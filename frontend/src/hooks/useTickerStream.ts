"use client";

import { useEffect, useState, useRef } from "react";

interface TickerData {
  symbol: string;
  price: number;
  change: number;
}

export function useTickerStream(symbols: string[]) {
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_FINNHUB_KEY;
    if (!key) return;

    const ws = new WebSocket(`wss://ws.finnhub.io?token=${key}`);
    wsRef.current = ws;

    ws.onopen = () => {
      symbols.forEach((s) => {
        ws.send(JSON.stringify({ type: "subscribe", symbol: s }));
      });
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "trade" && data.data) {
        for (const trade of data.data) {
          setTickers((prev) => ({
            ...prev,
            [trade.s]: {
              symbol: trade.s,
              price: trade.p,
              change: prev[trade.s]
                ? ((trade.p - prev[trade.s].price) / prev[trade.s].price) * 100
                : 0,
            },
          }));
        }
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        symbols.forEach((s) => {
          ws.send(JSON.stringify({ type: "unsubscribe", symbol: s }));
        });
      }
      ws.close();
    };
  }, []);

  return tickers;
}
