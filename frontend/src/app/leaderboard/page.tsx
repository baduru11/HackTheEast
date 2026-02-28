"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { StaggerList, StaggerItem, FadeInUp } from "@/components/shared/MotionWrappers";

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
  "All Time": "all_time", Weekly: "weekly", Monthly: "monthly",
};

const TAB_ICONS: Record<MainTab, ReactNode> = {
  Global: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  Sector: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  ),
  Friends: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
};

/* ─── Crown SVG for #1 ─── */
function CrownIcon() {
  return (
    <svg className="w-7 h-7 mx-auto mb-1" viewBox="0 0 24 24" fill="none">
      <path d="M2 17l3-10 5 5 2-9 2 9 5-5 3 10H2z" fill="#fbbf24" stroke="#f59e0b" strokeWidth={1} strokeLinejoin="round" />
      <circle cx="5" cy="7" r="1.5" fill="#fbbf24" />
      <circle cx="12" cy="3" r="1.5" fill="#fbbf24" />
      <circle cx="19" cy="7" r="1.5" fill="#fbbf24" />
    </svg>
  );
}

/* ─── Podium avatar ─── */
function PodiumAvatar({ url, name, size }: { url: string | null; name: string | null; size: "lg" | "md" }) {
  const s = size === "lg" ? "w-16 h-16" : "w-12 h-12";
  const textS = size === "lg" ? "text-xl" : "text-base";
  if (url) return <img src={url} alt="" className={`${s} rounded-full object-cover mx-auto`} />;
  return (
    <div className={`${s} rounded-full bg-gray-800 flex items-center justify-center ${textS} font-bold text-gray-500 mx-auto`}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

/* ─── Rank config ─── */
const RANK_CFG: Record<number, { border: string; glow: string; pedestal: string; pedestalH: string; ring: string }> = {
  1: {
    border: "border-yellow-400/30",
    glow: "glow-gold",
    pedestal: "bg-gradient-to-t from-yellow-400/15 to-yellow-400/5",
    pedestalH: "h-10",
    ring: "ring-2 ring-yellow-400/40",
  },
  2: {
    border: "border-gray-400/25",
    glow: "glow-silver",
    pedestal: "bg-gradient-to-t from-gray-400/10 to-gray-400/5",
    pedestalH: "h-6",
    ring: "ring-2 ring-gray-400/30",
  },
  3: {
    border: "border-amber-600/25",
    glow: "glow-bronze",
    pedestal: "bg-gradient-to-t from-amber-600/12 to-amber-600/5",
    pedestalH: "h-3",
    ring: "ring-2 ring-amber-600/30",
  },
};

/* ─── Podium Section ─── */
function Podium({ entries }: { entries: LBEntry[] }) {
  if (entries.length < 3) return null;
  // Order: #2, #1, #3
  const podium = [entries[1], entries[0], entries[2]];
  const ranks = [2, 1, 3];

  return (
    <FadeInUp>
      <div className="flex items-end justify-center gap-3 mb-8">
        {podium.map((entry, i) => {
          const rank = ranks[i];
          const cfg = RANK_CFG[rank];
          const xp = entry.xp ?? entry.total_xp ?? entry.sector_xp ?? 0;
          const isFirst = rank === 1;

          return (
            <div key={entry.user_id} className="flex-1 max-w-[180px]">
              <div className={`text-center rounded-xl bg-gray-900/80 border ${cfg.border} ${cfg.glow} ${isFirst ? "p-5" : "p-4"}`}>
                {isFirst && <CrownIcon />}
                <div className={cfg.ring + " rounded-full mx-auto w-fit"}>
                  <PodiumAvatar url={entry.avatar_url} name={entry.username} size={isFirst ? "lg" : "md"} />
                </div>
                <p className={`${isFirst ? "text-base font-bold" : "text-sm font-semibold"} text-white mt-2 truncate`}>
                  {entry.username || "Anonymous"}
                </p>
                <p className={`${isFirst ? "text-sm" : "text-xs"} font-bold text-teal-400 mt-1`}>
                  {xp.toLocaleString()} XP
                </p>
              </div>
              <div className={`${cfg.pedestalH} ${cfg.pedestal} rounded-b-lg mx-1`} />
            </div>
          );
        })}
      </div>
    </FadeInUp>
  );
}

/* ─── Main Component ─── */
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
      if (token) {
        url = `/api/v1/leaderboard/friends?period=${periodParam}`;
        fetchOptions = { headers: { Authorization: `Bearer ${token}` } };
      } else {
        setEntries([]);
        setLoading(false);
        return;
      }
    }

    fetch(url, fetchOptions)
      .then(r => r.json())
      .then(res => { if (res.success) setEntries(res.data || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [mainTab, period, sectorSlug, token]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-white mb-1">Leaderboard</h1>
      <p className="text-sm text-gray-500 mb-6">Compete with the community</p>

      {/* Main tabs */}
      <div className="flex gap-2 mb-4">
        {MAIN_TABS.map(t => (
          <button
            key={t}
            onClick={() => setMainTab(t)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              mainTab === t
                ? "bg-teal-400/10 text-teal-400 border border-teal-400/30 shadow-[0_0_12px_rgba(45,212,191,0.08)]"
                : "text-gray-500 hover:text-gray-300 border border-transparent"
            }`}
          >
            {TAB_ICONS[t]}
            {t}
          </button>
        ))}
      </div>

      {/* Sector pills */}
      {mainTab === "Sector" && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {SECTOR_OPTIONS.map(s => (
            <button
              key={s.slug}
              onClick={() => setSectorSlug(s.slug)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
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

      {/* Period pills */}
      <div className="flex gap-1.5 mb-6">
        {PERIOD_TABS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              period === p
                ? "bg-gray-800 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Content */}
      {mainTab === "Friends" && !token ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="text-gray-500">Sign in to see friends leaderboard</p>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => <div key={i} className="h-14 skeleton-shimmer rounded-xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-3.52 1.122 6.023 6.023 0 01-3.52-1.122" />
            </svg>
          </div>
          <p className="text-gray-500">{mainTab === "Friends" ? "Add friends to compete!" : "No rankings yet"}</p>
        </div>
      ) : (
        <>
          {/* Podium for top 3 */}
          {top3.length >= 3 && <Podium entries={top3} />}

          {/* Rank list (4+ or all if < 3) */}
          {(top3.length < 3 ? entries : rest).length > 0 && (
            <StaggerList className="space-y-1.5">
              {(top3.length < 3 ? entries : rest).map(entry => {
                const xp = entry.xp ?? entry.total_xp ?? entry.sector_xp ?? 0;
                const isTop3 = entry.rank <= 3;
                const rankColor = isTop3
                  ? entry.rank === 1 ? "text-yellow-400" : entry.rank === 2 ? "text-gray-300" : "text-amber-600"
                  : "text-gray-500";

                return (
                  <StaggerItem key={entry.user_id}>
                    <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-800/60 hover:border-gray-700/60 transition-all">
                      <span className={`w-8 text-center text-sm font-bold ${rankColor}`}>
                        #{entry.rank}
                      </span>
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500">
                          {(entry.username || "?")[0].toUpperCase()}
                        </div>
                      )}
                      <span className="flex-1 text-sm text-white font-medium truncate">
                        {entry.username || "Anonymous"}
                      </span>
                      <span className="text-sm text-teal-400 font-bold">
                        {xp.toLocaleString()} XP
                      </span>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}
        </>
      )}
    </div>
  );
}
