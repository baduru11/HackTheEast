"use client";

import { useTickerStream } from "@/hooks/useTickerStream";

const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM"];

function TriangleUp() {
  return (
    <svg className="w-2.5 h-2.5 inline-block" viewBox="0 0 10 10" fill="currentColor">
      <path d="M5 1L9.33 8H0.67L5 1Z" />
    </svg>
  );
}

function TriangleDown() {
  return (
    <svg className="w-2.5 h-2.5 inline-block" viewBox="0 0 10 10" fill="currentColor">
      <path d="M5 9L0.67 2H9.33L5 9Z" />
    </svg>
  );
}

export default function TickerBar() {
  const tickers = useTickerStream(DEFAULT_SYMBOLS);
  const entries = Object.values(tickers);

  if (entries.length === 0) {
    return (
      <div className="bg-gray-900 border-t border-gray-800 overflow-hidden">
        <div className="h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent" />
        <div className="py-2">
          <div className="flex items-center gap-8 animate-marquee whitespace-nowrap">
            {DEFAULT_SYMBOLS.concat(DEFAULT_SYMBOLS).map((s, i) => (
              <span key={i} className="text-xs text-gray-600">
                {s} --
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const doubled = [...entries, ...entries];

  return (
    <div className="bg-gray-900 border-t border-gray-800 overflow-hidden">
      <div className="h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent" />
      <div className="py-2">
        <div className="flex items-center gap-8 animate-marquee whitespace-nowrap">
          {doubled.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-gray-300">{t.symbol}</span>
              <span className="text-gray-400 font-mono">${t.price.toFixed(2)}</span>
              <span className={`inline-flex items-center gap-0.5 ${t.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {t.change >= 0 ? <TriangleUp /> : <TriangleDown />}
                {Math.abs(t.change).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
