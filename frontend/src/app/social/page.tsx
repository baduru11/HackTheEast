"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { ActivityFeedItem } from "@/types";
import Link from "next/link";

const EMOJI_MAP: Record<string, string> = {
  fire: "\u{1F525}",
  brain: "\u{1F9E0}",
  clap: "\u{1F44F}",
  rocket: "\u{1F680}",
  flex: "\u{1F4AA}",
  bullseye: "\u{1F3AF}",
};

const EMOJI_KEYS = Object.keys(EMOJI_MAP);

function formatActivity(item: ActivityFeedItem): string {
  const meta = item.metadata;
  switch (item.activity_type) {
    case "quiz_completed":
      return `scored ${meta.score}/${meta.max_score} on "${meta.article_title}"`;
    case "gauge_milestone":
      return `hit ${meta.threshold} gauge in ${meta.sector_name}`;
    case "streak_milestone":
      return `reached a ${meta.streak_days}-day streak!`;
    default:
      return "did something awesome";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SocialFeedPage() {
  const { user, session } = useAuth();
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const token = session?.access_token;

  const fetchFeed = useCallback(async (cursor?: string) => {
    if (!token) return;
    const isMore = !!cursor;
    if (isMore) setLoadingMore(true); else setLoading(true);

    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
    const res = await apiFetch<ActivityFeedItem[]>(`/feed/friends${params}`, { token });

    if (res.data) {
      if (isMore) {
        setItems((prev) => [...prev, ...res.data!]);
      } else {
        setItems(res.data);
      }
    }
    setNextCursor(res.meta?.next_cursor as string | null);
    if (isMore) setLoadingMore(false); else setLoading(false);
  }, [token]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const handleReact = async (activityId: string, emoji: string) => {
    if (!token) return;
    const item = items.find((i) => i.id === activityId);
    if (!item) return;

    if (item.my_reaction === emoji) {
      // Remove reaction
      await apiFetch(`/feed/${activityId}/react`, { token, method: "DELETE" });
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== activityId) return i;
          return {
            ...i,
            my_reaction: null,
            reactions: i.reactions
              .map((r) => r.emoji === emoji ? { ...r, count: r.count - 1 } : r)
              .filter((r) => r.count > 0),
          };
        })
      );
    } else {
      // Add/change reaction
      await apiFetch(`/feed/${activityId}/react`, {
        token,
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== activityId) return i;
          const oldEmoji = i.my_reaction;
          let reactions = [...i.reactions];
          // Remove old reaction count
          if (oldEmoji) {
            reactions = reactions
              .map((r) => r.emoji === oldEmoji ? { ...r, count: r.count - 1 } : r)
              .filter((r) => r.count > 0);
          }
          // Add new reaction count
          const existing = reactions.find((r) => r.emoji === emoji);
          if (existing) {
            reactions = reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1 } : r);
          } else {
            reactions.push({ emoji, count: 1 });
          }
          return { ...i, my_reaction: emoji, reactions };
        })
      );
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-400 mb-4">Sign in to see your friends' activity</p>
        <Link href="/login" className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-6 py-2 rounded-lg">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Social Feed</h1>
        <Link
          href="/friends"
          className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          Manage friends
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 skeleton-shimmer rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-2">No activity yet</p>
          <p className="text-gray-600 text-sm">
            <Link href="/friends" className="text-teal-400 hover:text-teal-300">Add friends</Link> to see their activity here
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="px-4 py-4 rounded-lg bg-gray-900 border border-gray-800">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  {item.avatar_url ? (
                    <img src={item.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                      {(item.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-medium">{item.username || "Anonymous"}</span>{" "}
                      <span className="text-gray-400">{formatActivity(item)}</span>
                    </p>
                    <p className="text-xs text-gray-600">{timeAgo(item.created_at)}</p>
                  </div>
                </div>

                {/* Reactions */}
                <div className="flex items-center gap-1 mt-3">
                  {EMOJI_KEYS.map((key) => {
                    const count = item.reactions.find((r) => r.emoji === key)?.count || 0;
                    const isMyReaction = item.my_reaction === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleReact(item.id, key)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                          isMyReaction
                            ? "bg-teal-400/10 border border-teal-400/30"
                            : count > 0
                              ? "bg-gray-800 border border-gray-700"
                              : "bg-gray-800/50 border border-transparent hover:border-gray-700"
                        }`}
                      >
                        <span>{EMOJI_MAP[key]}</span>
                        {count > 0 && <span className={isMyReaction ? "text-teal-400" : "text-gray-400"}>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          {nextCursor && (
            <div className="text-center mt-6">
              <button
                onClick={() => fetchFeed(nextCursor)}
                disabled={loadingMore}
                className="text-sm text-teal-400 hover:text-teal-300 disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
