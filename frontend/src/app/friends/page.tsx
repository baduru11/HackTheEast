"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { FriendProfile, FriendRequest } from "@/types";
import Link from "next/link";

export default function FriendsPage() {
  const { user, session } = useAuth();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const token = session?.access_token;

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const [friendsRes, requestsRes] = await Promise.all([
      apiFetch<FriendProfile[]>("/friends", { token }),
      apiFetch<FriendRequest[]>("/friends/requests", { token }),
    ]);
    if (friendsRes.data) setFriends(friendsRes.data);
    if (requestsRes.data) setRequests(requestsRes.data);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = async () => {
    if (!token || searchQuery.length < 1) return;
    setSearching(true);
    const res = await apiFetch<FriendProfile[]>(`/friends/search?q=${encodeURIComponent(searchQuery)}`, { token });
    if (res.data) setSearchResults(res.data);
    setSearching(false);
  };

  const sendRequest = async (addresseeId: string) => {
    if (!token) return;
    await apiFetch("/friends/request", {
      token,
      method: "POST",
      body: JSON.stringify({ addressee_id: addresseeId }),
    });
    setSearchResults((prev) => prev.filter((u) => u.id !== addresseeId));
  };

  const acceptRequest = async (friendshipId: string) => {
    if (!token) return;
    await apiFetch(`/friends/accept/${friendshipId}`, { token, method: "POST" });
    fetchData();
  };

  const rejectRequest = async (friendshipId: string) => {
    if (!token) return;
    await apiFetch(`/friends/reject/${friendshipId}`, { token, method: "POST" });
    setRequests((prev) => prev.filter((r) => r.friendship_id !== friendshipId));
  };

  const unfriend = async (friendshipId: string) => {
    if (!token) return;
    await apiFetch(`/friends/${friendshipId}`, { token, method: "DELETE" });
    setFriends((prev) => prev.filter((f) => f.friendship_id !== friendshipId));
  };

  const copyInviteLink = async () => {
    if (!token) return;
    const res = await apiFetch<{ link: string }>("/friends/invite-link", { token });
    if (res.data?.link) {
      await navigator.clipboard.writeText(window.location.origin + res.data.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-400 mb-4">Sign in to add friends</p>
        <Link href="/login" className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-6 py-2 rounded-lg">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Friends</h1>
        <button
          onClick={copyInviteLink}
          className="bg-teal-500/10 text-teal-400 border border-teal-400/30 text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-teal-500/20 transition-colors"
        >
          {copied ? "Copied!" : "Share invite link"}
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search by username..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-400/50"
        />
        <button
          onClick={handleSearch}
          disabled={searching || searchQuery.length < 1}
          className="bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Search
        </button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Search Results</p>
          <div className="space-y-1">
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900 border border-gray-800">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                    {(u.username || "?")[0].toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm text-white font-medium">{u.username || "Anonymous"}</span>
                <span className="text-xs text-gray-500">{u.total_xp.toLocaleString()} XP</span>
                <button
                  onClick={() => sendRequest(u.id)}
                  className="text-xs bg-teal-500/10 text-teal-400 border border-teal-400/30 px-3 py-1 rounded-lg hover:bg-teal-500/20"
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
        <div className="mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Pending Requests</p>
          <div className="space-y-1">
            {requests.map((r) => (
              <div key={r.friendship_id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900 border border-yellow-500/20">
                {r.user.avatar_url ? (
                  <img src={r.user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                    {(r.user.username || "?")[0].toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm text-white font-medium">{r.user.username || "Anonymous"}</span>
                <button
                  onClick={() => acceptRequest(r.friendship_id)}
                  className="text-xs bg-teal-500 text-white px-3 py-1 rounded-lg hover:bg-teal-400"
                >
                  Accept
                </button>
                <button
                  onClick={() => rejectRequest(r.friendship_id)}
                  className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1"
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
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
          Friends {!loading && `(${friends.length})`}
        </p>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 skeleton-shimmer rounded-lg" />
            ))}
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">No friends yet</p>
            <p className="text-gray-600 text-sm">Search for users or share your invite link</p>
          </div>
        ) : (
          <div className="space-y-1">
            {friends.map((f) => (
              <div key={f.friendship_id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 group">
                {f.avatar_url ? (
                  <img src={f.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                    {(f.username || "?")[0].toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm text-white font-medium">{f.username || "Anonymous"}</span>
                <span className="text-xs text-gray-500">{f.total_xp.toLocaleString()} XP</span>
                <button
                  onClick={() => unfriend(f.friendship_id)}
                  className="text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1"
                >
                  Unfriend
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
