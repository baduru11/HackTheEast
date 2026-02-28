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

  // Fetch initial prices via Finnhub REST API
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_FINNHUB_KEY;
    if (!key) return;

    async function fetchInitialQuotes() {
      for (const symbol of symbols) {
        try {
          const res = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`
          );
          const data = await res.json();
          if (data.c && data.c > 0) {
            setTickers((prev) => ({
              ...prev,
              [symbol]: {
                symbol,
                price: data.c,       // current price
                change: data.dp || 0, // percent change from previous close
              },
            }));
          }
        } catch (e) {
          console.error(`Failed to fetch quote for ${symbol}:`, e);
        }
      }
    }

    fetchInitialQuotes();
  }, []);

  // WebSocket for live updates (during market hours)
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
          setTickers((prev) => {
            const existing = prev[trade.s];
            return {
              ...prev,
              [trade.s]: {
                symbol: trade.s,
                price: trade.p,
                change: existing
                  ? ((trade.p - existing.price) / existing.price) * 100
                  : 0,
              },
            };
          });
        }
      }
    };

    ws.onerror = (e) => {
      console.error("Finnhub WebSocket error:", e);
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
