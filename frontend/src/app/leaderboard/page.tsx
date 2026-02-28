"use client";

import { useEffect, useState } from "react";

interface LBEntry {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_xp?: number;
  sector_xp?: number;
  rank: number;
}

const SECTOR_TABS = [
  { label: "Global", slug: "" },
  { label: "Crypto", slug: "crypto" },
  { label: "Stocks", slug: "stocks" },
  { label: "Asia", slug: "asia" },
  { label: "Europe", slug: "europe" },
];

const RANK_STYLES: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-gray-300",
  3: "text-amber-600",
};

export default function LeaderboardPage() {
  const [tab, setTab] = useState("");
  const [entries, setEntries] = useState<LBEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = tab ? `/api/v1/leaderboard/${tab}` : "/api/v1/leaderboard";
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setEntries(res.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Leaderboard</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {SECTOR_TABS.map((t) => (
          <button
            key={t.slug}
            onClick={() => setTab(t.slug)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.slug
                ? "bg-teal-400/10 text-teal-400 border border-teal-400/30"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-900 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No rankings yet</p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => {
            const xp = entry.total_xp ?? entry.sector_xp ?? 0;
            return (
              <div
                key={entry.user_id}
                className="flex items-center gap-4 px-4 py-3 rounded-lg bg-gray-900 border border-gray-800"
              >
                <span
                  className={`w-8 text-center text-sm font-bold ${RANK_STYLES[entry.rank] || "text-gray-500"}`}
                >
                  {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
                </span>
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                    {(entry.username || "?")[0].toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm text-white font-medium truncate">
                  {entry.username || "Anonymous"}
                </span>
                <span className="text-sm text-teal-400 font-semibold">
                  {xp.toLocaleString()} XP
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
