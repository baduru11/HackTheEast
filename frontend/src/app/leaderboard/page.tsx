"use client";

import { useEffect, useState } from "react";
import { StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";

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

function MedalIcon({ rank }: { rank: number }) {
  const colors: Record<number, { fill: string; stroke: string }> = {
    1: { fill: "#fbbf24", stroke: "#f59e0b" },
    2: { fill: "#d1d5db", stroke: "#9ca3af" },
    3: { fill: "#d97706", stroke: "#b45309" },
  };
  const c = colors[rank];
  if (!c) return null;

  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="10" r="7" fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
      <text x="12" y="13" textAnchor="middle" fill="#1f2937" fontSize="8" fontWeight="bold">
        {rank}
      </text>
      <path d="M8 16l-2 6 4-2 2 2V16" fill={c.fill} opacity="0.7" />
      <path d="M16 16l2 6-4-2-2 2V16" fill={c.fill} opacity="0.7" />
    </svg>
  );
}

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
            <div key={i} className="h-14 skeleton-shimmer rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
          <p className="text-gray-500">No rankings yet</p>
        </div>
      ) : (
        <StaggerList className="space-y-1">
          {entries.map((entry) => {
            const xp = entry.total_xp ?? entry.sector_xp ?? 0;
            return (
              <StaggerItem key={entry.user_id}>
                <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-gray-900 border border-gray-800">
                  <span className={`w-8 flex items-center justify-center text-sm font-bold ${RANK_STYLES[entry.rank] || "text-gray-500"}`}>
                    {entry.rank <= 3 ? <MedalIcon rank={entry.rank} /> : `#${entry.rank}`}
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
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </div>
  );
}
