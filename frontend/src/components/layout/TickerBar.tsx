"use client";

import { useTickerStream } from "@/hooks/useTickerStream";

const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM"];

export default function TickerBar() {
  const tickers = useTickerStream(DEFAULT_SYMBOLS);
  const entries = Object.values(tickers);

  if (entries.length === 0) {
    return (
      <div className="bg-gray-900 border-t border-gray-800 py-2 overflow-hidden">
        <div className="flex items-center gap-8 animate-marquee whitespace-nowrap">
          {DEFAULT_SYMBOLS.concat(DEFAULT_SYMBOLS).map((s, i) => (
            <span key={i} className="text-xs text-gray-600">
              {s} --
            </span>
          ))}
        </div>
      </div>
    );
  }

  const doubled = [...entries, ...entries];

  return (
    <div className="bg-gray-900 border-t border-gray-800 py-2 overflow-hidden">
      <div className="flex items-center gap-8 animate-marquee whitespace-nowrap">
        {doubled.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-gray-300">{t.symbol}</span>
            <span className="text-gray-400">${t.price.toFixed(2)}</span>
            <span className={t.change >= 0 ? "text-green-400" : "text-red-400"}>
              {t.change >= 0 ? "▲" : "▼"}
              {Math.abs(t.change).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
