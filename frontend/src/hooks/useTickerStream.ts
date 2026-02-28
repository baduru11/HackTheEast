"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface TickerData {
  symbol: string;
  price: number;
  change: number;
}

function getWsUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
  const host = apiUrl.replace(/^https?:\/\//, "");
  return `${wsProtocol}://${host}/api/v1/market/ws`;
}

export function useTickerStream(symbols: string[]) {
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch initial prices via backend proxy
  useEffect(() => {
    async function fetchInitialQuotes() {
      try {
        const res = await fetch(
          `/api/v1/market/quotes?symbols=${symbols.join(",")}`
        );
        const json = await res.json();
        if (json.data) {
          const initial: Record<string, TickerData> = {};
          for (const q of json.data) {
            initial[q.ticker] = {
              symbol: q.ticker,
              price: q.price,
              change: q.price_change_pct || 0,
            };
          }
          setTickers(initial);
        }
      } catch {
        // REST quotes unavailable — ticker bar shows loading state
      }
    }

    fetchInitialQuotes();
  }, []);

  // WebSocket for live updates via backend proxy
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(getWsUrl());
    } catch {
      return; // invalid URL or blocked — skip silently
    }
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      symbols.forEach((s) => {
        ws.send(JSON.stringify({ type: "subscribe", symbol: s }));
      });
    };

    ws.onmessage = (event) => {
      try {
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
      } catch {
        // malformed message — ignore
      }
    };

    ws.onclose = () => {
      // Reconnect with exponential backoff, max 60s, max 5 retries
      if (retryRef.current < 5) {
        const delay = Math.min(2000 * 2 ** retryRef.current, 60000);
        retryRef.current++;
        timerRef.current = setTimeout(connectWs, delay);
      }
    };

    ws.onerror = () => {
      // onerror always fires before onclose — let onclose handle reconnect
    };
  }, [symbols]);

  useEffect(() => {
    connectWs();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      retryRef.current = 5; // prevent reconnect during cleanup
      const ws = wsRef.current;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          symbols.forEach((s) => {
            ws.send(JSON.stringify({ type: "unsubscribe", symbol: s }));
          });
        }
        ws.close();
      }
    };
  }, [connectWs]);

  return tickers;
}
