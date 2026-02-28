import type { Ticker } from "@/types";

export default function TickerBadges({ tickers }: { tickers: Ticker[] }) {
  if (!tickers.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {tickers.map((t) => (
        <span
          key={t.ticker}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-sm"
        >
          <span className="font-semibold text-white">{t.ticker}</span>
          {t.price != null && (
            <span className="text-gray-400">${t.price.toLocaleString()}</span>
          )}
          {t.price_change_pct != null && (
            <span className={t.price_change_pct >= 0 ? "text-green-400" : "text-red-400"}>
              {t.price_change_pct >= 0 ? "▲" : "▼"}
              {Math.abs(t.price_change_pct).toFixed(1)}%
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
