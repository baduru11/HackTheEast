"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";

interface LBEntry {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_xp?: number;
  sector_xp?: number;
  xp?: number;
  rank: number;
}

const MAIN_TABS = ["Global", "Sector", "Friends"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const PERIOD_TABS = ["All Time", "Weekly", "Monthly"] as const;
type PeriodTab = (typeof PERIOD_TABS)[number];

const SECTOR_OPTIONS = [
  { label: "Crypto", slug: "crypto" },
  { label: "Stocks", slug: "stocks" },
  { label: "Asia", slug: "asia" },
  { label: "Europe", slug: "europe" },
  { label: "Americas", slug: "americas" },
  { label: "India", slug: "india" },
];

const PERIOD_MAP: Record<PeriodTab, string> = {
  "All Time": "all_time",
  Weekly: "weekly",
  Monthly: "monthly",
};

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
  const { session } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>("Global");
  const [period, setPeriod] = useState<PeriodTab>("All Time");
  const [sectorSlug, setSectorSlug] = useState("crypto");
  const [entries, setEntries] = useState<LBEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const token = session?.access_token;

  useEffect(() => {
    setLoading(true);
    const periodParam = PERIOD_MAP[period];
    let url: string;
    let fetchOptions: RequestInit = {};

    if (mainTab === "Global") {
      url = `/api/v1/leaderboard/global?period=${periodParam}`;
    } else if (mainTab === "Sector") {
      url = `/api/v1/leaderboard/sector/${sectorSlug}?period=${periodParam}`;
    } else {
      // Friends - needs auth
      if (token) {
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        url = `${base}/api/v1/leaderboard/friends?period=${periodParam}`;
        fetchOptions = { headers: { Authorization: `Bearer ${token}` } };
      } else {
        setEntries([]);
        setLoading(false);
        return;
      }
    }

    fetch(url, fetchOptions)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setEntries(res.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [mainTab, period, sectorSlug, token]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Leaderboard</h1>

      {/* Main tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
        {MAIN_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setMainTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              mainTab === t
                ? "bg-teal-400/10 text-teal-400 border border-teal-400/30"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Sector selector (only shown for Sector tab) */}
      {mainTab === "Sector" && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
          {SECTOR_OPTIONS.map((s) => (
            <button
              key={s.slug}
              onClick={() => setSectorSlug(s.slug)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                sectorSlug === s.slug
                  ? "bg-gray-800 text-white border border-gray-700"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Period sub-tabs */}
      <div className="flex gap-1 mb-6">
        {PERIOD_TABS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              period === p
                ? "bg-gray-800 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Friends tab - not logged in */}
      {mainTab === "Friends" && !token ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-2">Sign in to see friends leaderboard</p>
        </div>
      ) : loading ? (
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
          <p className="text-gray-500">
            {mainTab === "Friends" ? "Add friends to compete!" : "No rankings yet"}
          </p>
        </div>
      ) : (
        <StaggerList className="space-y-1">
          {entries.map((entry) => {
            const xp = entry.xp ?? entry.total_xp ?? entry.sector_xp ?? 0;
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
