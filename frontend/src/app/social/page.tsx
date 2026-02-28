"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { ActivityFeedItem, FriendProfile, FriendRequest } from "@/types";
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

/* ─── Helpers ─── */
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
  if (url) return <img src={url} alt="" className={`${s} rounded-full object-cover`} />;
  return (
    <div className={`${s} rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-500`}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

/* ─── Main Component ─── */
export default function SocialPage() {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const [tab, setTab] = useState<"feed" | "friends">("feed");

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-white mb-1">Social</h1>
      <p className="text-sm text-gray-500 mb-6">See what your friends are up to</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("feed")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            tab === "feed"
              ? "bg-teal-400/10 text-teal-400 border border-teal-400/30 shadow-[0_0_12px_rgba(45,212,191,0.08)]"
              : "text-gray-500 hover:text-gray-300 border border-transparent"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          Activity
        </button>
        <button
          onClick={() => setTab("friends")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            tab === "friends"
              ? "bg-teal-400/10 text-teal-400 border border-teal-400/30 shadow-[0_0_12px_rgba(45,212,191,0.08)]"
              : "text-gray-500 hover:text-gray-300 border border-transparent"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          Friends
          {requests.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* ═══ FEED TAB ═══ */}
      {tab === "feed" && (
        <>
          {feedLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-28 skeleton-shimmer rounded-xl" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <p className="text-gray-500 mb-1">No activity yet</p>
              <p className="text-gray-600 text-sm">
                <button onClick={() => setTab("friends")} className="text-teal-400 hover:text-teal-300">Add friends</button>{" "}
                to see their achievements
              </p>
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
                          {/* Type icon */}
                          <div className={`w-9 h-9 rounded-lg ${style.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <TypeIcon type={item.activity_type} className={`w-5 h-5 ${style.text}`} />
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Avatar url={item.avatar_url} name={item.username} size="sm" />
                              <span className="font-semibold text-sm text-white truncate">{item.username || "Anonymous"}</span>
                              <span className="text-[11px] text-gray-600 shrink-0">{timeAgo(item.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">{formatActivity(item)}</p>
                          </div>
                          {/* Score badge */}
                          {badge && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0 ${style.badge}`}>
                              {badge}
                            </span>
                          )}
                        </div>

                        {/* Reactions */}
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
        </>
      )}

      {/* ═══ FRIENDS TAB ═══ */}
      {tab === "friends" && (
        <>
          {/* Search + Invite */}
          <div className="flex gap-2 mb-5">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Search by username..."
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
            <div className="mb-5">
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-medium mb-2">Search Results</p>
              <div className="space-y-1.5">
                {searchResults.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-800/60">
                    <Avatar url={u.avatar_url} name={u.username} />
                    <span className="flex-1 text-sm text-white font-medium truncate">{u.username || "Anonymous"}</span>
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
            </div>
          )}

          {/* Pending Requests */}
          {requests.length > 0 && (
            <div className="mb-5">
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-medium mb-2">
                Pending Requests
                <span className="ml-2 inline-flex w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold items-center justify-center align-middle">
                  {requests.length}
                </span>
              </p>
              <div className="space-y-1.5">
                {requests.map(r => (
                  <div key={r.friendship_id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.03] border border-amber-500/15">
                    <Avatar url={r.user.avatar_url} name={r.user.username} />
                    <span className="flex-1 text-sm text-white font-medium truncate">{r.user.username || "Anonymous"}</span>
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
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-widest font-medium mb-2">
              Friends {!friendsLoading && `(${friends.length})`}
            </p>
            {friendsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-14 skeleton-shimmer rounded-xl" />)}
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-1">No friends yet</p>
                <p className="text-gray-600 text-sm">Search for users to add friends</p>
              </div>
            ) : (
              <StaggerList className="space-y-1.5">
                {friends.map(f => (
                  <StaggerItem key={f.friendship_id}>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-800/60 group hover:border-gray-700/60 transition-all">
                      <Avatar url={f.avatar_url} name={f.username} />
                      <span className="flex-1 text-sm text-white font-medium truncate">{f.username || "Anonymous"}</span>
                      <span className="text-xs text-teal-400/70 font-medium">{f.total_xp.toLocaleString()} XP</span>
                      <button
                        onClick={() => unfriend(f.friendship_id)}
                        className="text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all px-2 py-1"
                      >
                        Unfriend
                      </button>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </div>
        </>
      )}
    </div>
  );
}
