"use client";

import { useTickerStream } from "@/hooks/useTickerStream";

const INDICES = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^DJI",  label: "Dow Jones" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^RUT",  label: "Russell 2000" },
  { symbol: "^N225", label: "Nikkei 225" },
  { symbol: "^GDAXI",label: "DAX" },
  { symbol: "^FTSE", label: "FTSE 100" },
  { symbol: "^HSI",  label: "Hang Seng" },
];

const SYMBOLS = INDICES.map((i) => i.symbol);
const LABEL_MAP: Record<string, string> = Object.fromEntries(
  INDICES.map((i) => [i.symbol, i.label])
);

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
  const tickers = useTickerStream(SYMBOLS);
  const entries = INDICES.map((idx) => tickers[idx.symbol]).filter(Boolean);

  if (entries.length === 0) {
    return (
      <div className="bg-gray-900 border-t border-gray-800 overflow-hidden">
        <div className="h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent" />
        <div className="py-2">
          <div className="flex items-center gap-8 animate-marquee whitespace-nowrap">
            {INDICES.concat(INDICES).map((idx, i) => (
              <span key={i} className="text-xs text-gray-600">
                {idx.label} --
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
              <span className="font-semibold text-gray-300">
                {LABEL_MAP[t.symbol] || t.symbol}
              </span>
              <span className="text-gray-400 font-mono">
                {t.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </span>
              <span className={`inline-flex items-center gap-0.5 font-mono ${t.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
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
