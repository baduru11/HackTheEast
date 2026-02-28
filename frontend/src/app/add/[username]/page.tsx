"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number;
}

export default function AddFriendPage() {
  const params = useParams<{ username: string }>();
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "sent" | "already" | "error">("idle");

  const token = session?.access_token;

  useEffect(() => {
    async function load() {
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await apiFetch<UserProfile[]>(`/friends/search?q=${encodeURIComponent(params.username)}`, { token });
      const match = res.data?.find((u) => u.username === params.username);
      if (match) setProfile(match);
      setLoading(false);
    }
    load();
  }, [params.username, token]);

  const sendRequest = async () => {
    if (!token || !profile) return;
    const res = await apiFetch<{ friendship_id: string }>("/friends/request", {
      token,
      method: "POST",
      body: JSON.stringify({ addressee_id: profile.id }),
    });
    if (res.success) {
      setStatus("sent");
    } else if (res.error?.code === "ALREADY_FRIENDS") {
      setStatus("already");
    } else if (res.error?.code === "ALREADY_PENDING") {
      setStatus("sent");
    } else {
      setStatus("error");
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 mb-4">Sign in to add <span className="text-white font-medium">{params.username}</span> as a friend</p>
        <Link href="/login" className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-6 py-2 rounded-lg">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 skeleton-shimmer rounded-full mx-auto mb-4" />
        <div className="h-4 w-32 skeleton-shimmer rounded mx-auto mb-2" />
        <div className="h-3 w-20 skeleton-shimmer rounded mx-auto" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-gray-400">User <span className="text-white font-medium">{params.username}</span> not found</p>
        <Link href="/friends" className="text-sm text-teal-400 hover:text-teal-300 mt-4 inline-block">
          Go to friends
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full mx-auto mb-4" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-2xl font-bold text-gray-400 mx-auto mb-4">
            {(profile.display_name || profile.username || "?")[0].toUpperCase()}
          </div>
        )}
        <h2 className="text-xl font-bold text-white mb-1">
          {profile.display_name || profile.username}
        </h2>
        {profile.display_name && profile.username && (
          <p className="text-sm text-gray-500 mb-2">@{profile.username}</p>
        )}
        <p className="text-sm text-teal-400 mb-6">{profile.total_xp.toLocaleString()} XP</p>

        {status === "idle" && (
          <button
            onClick={sendRequest}
            className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
          >
            Add Friend
          </button>
        )}
        {status === "sent" && (
          <p className="text-teal-400 text-sm font-medium">Request sent!</p>
        )}
        {status === "already" && (
          <p className="text-gray-400 text-sm">Already friends</p>
        )}
        {status === "error" && (
          <p className="text-red-400 text-sm">Something went wrong</p>
        )}
      </div>
    </div>
  );
}
