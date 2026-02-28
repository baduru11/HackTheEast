"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { ActivityFeedItem, FriendProfile, FriendRequest, FriendSector } from "@/types";
import { StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";
import Link from "next/link";

/* ─── Constants ─── */
const EMOJI_MAP: Record<string, string> = {
  fire: "\u{1F525}", brain: "\u{1F9E0}", clap: "\u{1F44F}",
  rocket: "\u{1F680}", flex: "\u{1F4AA}", bullseye: "\u{1F3AF}",
};
const EMOJI_KEYS = Object.keys(EMOJI_MAP);

const TYPE_STYLES: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  quiz_completed: {
    border: "border-l-indigo-500/70",
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  },
  gauge_milestone: {
    border: "border-l-amber-500/70",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  },
  streak_milestone: {
    border: "border-l-orange-500/70",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  },
};
const FALLBACK_STYLE = {
  border: "border-l-gray-600", bg: "bg-gray-700/10",
  text: "text-gray-400", badge: "bg-gray-700/15 text-gray-400 border-gray-600/25",
};

const SECTOR_BAR: Record<string, string> = {
  crypto: "bg-orange-400", stocks: "bg-blue-400", options: "bg-violet-400",
  bonds: "bg-slate-400", currency: "bg-green-400", etfs: "bg-cyan-400",
  indices: "bg-indigo-400", sector: "bg-pink-400", asia: "bg-rose-400",
  americas: "bg-sky-400", europe: "bg-blue-300", india: "bg-amber-400",
  china: "bg-red-400", japan: "bg-fuchsia-400", war: "bg-red-500",
};

const SECTOR_TEXT: Record<string, string> = {
  crypto: "text-orange-400", stocks: "text-blue-400", options: "text-violet-400",
  bonds: "text-slate-400", currency: "text-green-400", etfs: "text-cyan-400",
  indices: "text-indigo-400", sector: "text-pink-400", asia: "text-rose-400",
  americas: "text-sky-400", europe: "text-blue-300", india: "text-amber-400",
  china: "text-red-400", japan: "text-fuchsia-400", war: "text-red-500",
};

/* ─── Helpers ─── */
function userName(u: { username?: string | null; display_name?: string | null }): string {
  return u.display_name || u.username || "Anonymous";
}

function formatActivity(item: ActivityFeedItem): string {
  const m = item.metadata as Record<string, unknown>;
  switch (item.activity_type) {
    case "quiz_completed": return `scored ${m.score}/${m.max_score} on "${m.article_title}"`;
    case "gauge_milestone": return `hit ${m.threshold} gauge in ${m.sector_name}`;
    case "streak_milestone": return `reached a ${m.streak_days}-day streak!`;
    default: return "did something awesome";
  }
}

function getBadgeText(item: ActivityFeedItem): string | null {
  const m = item.metadata as Record<string, unknown>;
  switch (item.activity_type) {
    case "quiz_completed": return `${m.score}/${m.max_score}`;
    case "gauge_milestone": return `${m.threshold}`;
    case "streak_milestone": return `${m.streak_days}d`;
    default: return null;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/* ─── SVG Icons ─── */
function TypeIcon({ type, className }: { type: string; className?: string }) {
  const c = className || "w-5 h-5";
  switch (type) {
    case "quiz_completed":
      return (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>);
    case "gauge_milestone":
      return (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>);
    case "streak_milestone":
      return (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
      </svg>);
    default:
      return (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>);
  }
}

function Avatar({ url, name, size = "md" }: { url: string | null; name: string | null; size?: "sm" | "md" }) {
  const s = size === "sm" ? "w-7 h-7 text-[10px]" : "w-10 h-10 text-sm";
  if (url) return <img src={url} alt="" className={`${s} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${s} rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-500 flex-shrink-0`}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

/* ─── Main Component ─── */
export default function SocialPage() {
  const { user, session } = useAuth();
  const token = session?.access_token;

  // Feed state
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Friends state
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendsExpanded, setFriendsExpanded] = useState(false);

  /* ─── Data fetching ─── */
  const fetchFeed = useCallback(async (cursor?: string) => {
    if (!token) return;
    const isMore = !!cursor;
    if (isMore) setLoadingMore(true); else setFeedLoading(true);
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
    const res = await apiFetch<ActivityFeedItem[]>(`/feed/friends${params}`, { token });
    if (res.data) {
      if (isMore) setItems(prev => [...prev, ...res.data!]);
      else setItems(res.data);
    }
    setNextCursor(res.meta?.next_cursor as string | null);
    if (isMore) setLoadingMore(false); else setFeedLoading(false);
  }, [token]);

  const fetchFriends = useCallback(async () => {
    if (!token) return;
    setFriendsLoading(true);
    const [fRes, rRes] = await Promise.all([
      apiFetch<FriendProfile[]>("/friends", { token }),
      apiFetch<FriendRequest[]>("/friends/requests", { token }),
    ]);
    if (fRes.data) setFriends(fRes.data);
    if (rRes.data) setRequests(rRes.data);
    setFriendsLoading(false);
  }, [token]);

  useEffect(() => { fetchFeed(); fetchFriends(); }, [fetchFeed, fetchFriends]);

  /* ─── Friend actions ─── */
  const handleSearch = async () => {
    if (!token || searchQuery.length < 1) return;
    setSearching(true);
    const res = await apiFetch<FriendProfile[]>(`/friends/search?q=${encodeURIComponent(searchQuery)}`, { token });
    if (res.data) setSearchResults(res.data);
    setSearching(false);
  };

  const sendRequest = async (id: string) => {
    if (!token) return;
    await apiFetch("/friends/request", { token, method: "POST", body: JSON.stringify({ addressee_id: id }) });
    setSearchResults(prev => prev.filter(u => u.id !== id));
  };

  const acceptRequest = async (id: string) => {
    if (!token) return;
    await apiFetch(`/friends/accept/${id}`, { token, method: "POST" });
    fetchFriends();
  };

  const rejectRequest = async (id: string) => {
    if (!token) return;
    await apiFetch(`/friends/reject/${id}`, { token, method: "POST" });
    setRequests(prev => prev.filter(r => r.friendship_id !== id));
  };

  const unfriend = async (id: string) => {
    if (!token) return;
    await apiFetch(`/friends/${id}`, { token, method: "DELETE" });
    setFriends(prev => prev.filter(f => f.friendship_id !== id));
  };

  /* ─── Reactions ─── */
  const handleReact = async (activityId: string, emoji: string) => {
    if (!token) return;
    const item = items.find(i => i.id === activityId);
    if (!item) return;

    if (item.my_reaction === emoji) {
      await apiFetch(`/feed/${activityId}/react`, { token, method: "DELETE" });
      setItems(prev => prev.map(i => {
        if (i.id !== activityId) return i;
        return { ...i, my_reaction: null, reactions: i.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count - 1 } : r).filter(r => r.count > 0) };
      }));
    } else {
      await apiFetch(`/feed/${activityId}/react`, { token, method: "POST", body: JSON.stringify({ emoji }) });
      setItems(prev => prev.map(i => {
        if (i.id !== activityId) return i;
        const old = i.my_reaction;
        let rx = [...i.reactions];
        if (old) rx = rx.map(r => r.emoji === old ? { ...r, count: r.count - 1 } : r).filter(r => r.count > 0);
        const ex = rx.find(r => r.emoji === emoji);
        if (ex) rx = rx.map(r => r.emoji === emoji ? { ...r, count: r.count + 1 } : r);
        else rx.push({ emoji, count: 1 });
        return { ...i, my_reaction: emoji, reactions: rx };
      }));
    }
  };

  /* ─── Auth guard ─── */
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>
        <p className="text-gray-400 mb-4">Sign in to see your friends&apos; activity</p>
        <Link href="/login" className="inline-flex bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">
          Sign in
        </Link>
      </div>
    );
  }

  const visibleFriends = friendsExpanded ? friends : friends.slice(0, 4);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-1">Social</h1>
      <p className="text-sm text-gray-500 mb-6">See what your friends are up to</p>

      {/* ══════ FRIENDS SECTION ══════ */}
      <div className="mb-8">
        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Add friends by username..."
              className="w-full bg-gray-900/80 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-400/50 transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || searchQuery.length < 1}
            className="bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            Search
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-4 space-y-1.5">
            <p className="text-[11px] text-gray-500 uppercase tracking-widest font-medium mb-2">Results</p>
            {searchResults.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-800/60">
                <Avatar url={u.avatar_url} name={userName(u)} />
                <span className="flex-1 text-sm text-white font-medium truncate">{userName(u)}</span>
                <span className="text-xs text-teal-400/70 font-medium">{u.total_xp.toLocaleString()} XP</span>
                <button
                  onClick={() => sendRequest(u.id)}
                  className="text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-400/30 px-3 py-1.5 rounded-lg hover:bg-teal-500/20 transition-colors"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pending Requests */}
        {requests.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-widest font-medium mb-2">
              Pending Requests
              <span className="ml-2 inline-flex w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold items-center justify-center align-middle">
                {requests.length}
              </span>
            </p>
            <div className="space-y-1.5">
              {requests.map(r => (
                <div key={r.friendship_id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.03] border border-amber-500/15">
                  <Avatar url={r.user.avatar_url} name={userName(r.user)} />
                  <span className="flex-1 text-sm text-white font-medium truncate">{userName(r.user)}</span>
                  <button
                    onClick={() => acceptRequest(r.friendship_id)}
                    className="text-xs font-medium bg-teal-500 text-white px-3 py-1.5 rounded-lg hover:bg-teal-400 transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => rejectRequest(r.friendship_id)}
                    className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        {friendsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(2)].map((_, i) => <div key={i} className="h-32 skeleton-shimmer rounded-xl" />)}
          </div>
        ) : friends.length === 0 ? (
          <p className="text-sm text-gray-600">No friends yet — search above to add some</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleFriends.map(f => (
                <div key={f.friendship_id} className="group rounded-xl bg-gray-900/70 border border-gray-800/60 hover:border-gray-700/60 transition-all p-4">
                  {/* Header: avatar + name + XP + remove */}
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar url={f.avatar_url} name={userName(f)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{userName(f)}</p>
                      <p className="text-xs text-teal-400/70">{f.total_xp.toLocaleString()} XP</p>
                    </div>
                    <button
                      onClick={() => unfriend(f.friendship_id)}
                      className="text-[10px] text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all px-1"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Sector gauges */}
                  {(f.sectors ?? []).length > 0 ? (
                    <div className="space-y-1.5">
                      {(f.sectors ?? []).map((s: FriendSector) => (
                        <div key={s.slug}>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className={`text-[10px] font-medium ${SECTOR_TEXT[s.slug] || "text-gray-400"}`}>{s.name}</span>
                            <span className="text-[10px] text-gray-600">{s.xp} XP</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${SECTOR_BAR[s.slug] || "bg-teal-400"}`}
                              style={{ width: `${s.fill}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-600">No sector activity yet</p>
                  )}
                </div>
              ))}
            </div>
            {friends.length > 4 && (
              <button
                onClick={() => setFriendsExpanded(e => !e)}
                className="mt-2 text-xs text-gray-500 hover:text-teal-400 transition-colors"
              >
                {friendsExpanded ? "Show less" : `+${friends.length - 4} more`}
              </button>
            )}
          </>
        )}
      </div>

      {/* ══════ ACTIVITY FEED ══════ */}
      <div>
        <p className="text-[11px] text-gray-500 uppercase tracking-widest font-medium mb-3">Activity</p>

        {feedLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-28 skeleton-shimmer rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No activity yet — add friends to see their achievements</p>
          </div>
        ) : (
          <StaggerList className="space-y-3">
            {items.map(item => {
              const style = TYPE_STYLES[item.activity_type] || FALLBACK_STYLE;
              const badge = getBadgeText(item);
              return (
                <StaggerItem key={item.id}>
                  <div className={`rounded-xl bg-gray-900/80 border border-gray-800/60 border-l-4 ${style.border} hover:border-gray-700/60 transition-all duration-200`}>
                    <div className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg ${style.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                          <TypeIcon type={item.activity_type} className={`w-5 h-5 ${style.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Avatar url={item.avatar_url} name={userName(item)} size="sm" />
                            <span className="font-semibold text-sm text-white truncate">{userName(item)}</span>
                            <span className="text-[11px] text-gray-600 shrink-0">{timeAgo(item.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-400 leading-relaxed">{formatActivity(item)}</p>
                        </div>
                        {badge && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0 ${style.badge}`}>
                            {badge}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-3 pl-12">
                        {EMOJI_KEYS.map(key => {
                          const count = item.reactions.find(r => r.emoji === key)?.count || 0;
                          const active = item.my_reaction === key;
                          return (
                            <button
                              key={key}
                              onClick={() => handleReact(item.id, key)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all active:scale-95 ${
                                active
                                  ? "bg-teal-400/10 border border-teal-400/30 shadow-[0_0_8px_rgba(45,212,191,0.1)]"
                                  : count > 0
                                    ? "bg-gray-800/80 border border-gray-700/50"
                                    : "bg-gray-800/30 border border-transparent hover:border-gray-700/50 hover:bg-gray-800/60"
                              }`}
                            >
                              <span className="text-sm">{EMOJI_MAP[key]}</span>
                              {count > 0 && <span className={`font-medium ${active ? "text-teal-400" : "text-gray-400"}`}>{count}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerList>
        )}

        {nextCursor && !feedLoading && (
          <div className="text-center mt-6">
            <button
              onClick={() => fetchFeed(nextCursor)}
              disabled={loadingMore}
              className="text-sm text-teal-400 hover:text-teal-300 disabled:opacity-50 px-4 py-2 rounded-lg hover:bg-teal-400/5 transition-colors"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
