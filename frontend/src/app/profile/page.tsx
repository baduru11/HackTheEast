"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import GaugeMeter from "@/components/profile/GaugeMeter";
import WeeklyReports from "@/components/profile/WeeklyReports";
import { FadeInUp, StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";

interface DashboardData {
  profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    total_xp: number;
    created_at: string;
  };
  streak_days: number;
  global_rank: number | null;
  favorites: {
    sector_id: number;
    gauge_score: number;
    sectors: { name: string; slug: string; category: string };
  }[];
}

export default function ProfilePage() {
  const { user, session, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(() => {
    if (!session) return;
    setLoading(true);
    apiFetch<DashboardData>("/profile", { token: session.access_token })
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setLoading(false);
      return;
    }
    fetchProfile();
  }, [session, authLoading, fetchProfile]);

  const saveDisplayName = async () => {
    if (!session || !editName.trim()) return;
    setSaving(true);
    const res = await apiFetch("/profile", {
      token: session.access_token,
      method: "PUT",
      body: JSON.stringify({ display_name: editName.trim() }),
    });
    if (res.success) {
      fetchProfile();
      setEditing(false);
    }
    setSaving(false);
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-6">
          <div className="h-20 skeleton-shimmer rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 skeleton-shimmer rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400 mb-4">Sign in to view your profile</p>
        <Link
          href="/login"
          className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400 mb-4">Could not load profile. Check console for details.</p>
        <Link
          href="/"
          className="text-teal-400 hover:text-teal-300 text-sm transition-colors"
        >
          Go home
        </Link>
      </div>
    );
  }

  return (
    <FadeInUp>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="glass rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4">
            {data.profile.avatar_url ? (
              <img
                src={data.profile.avatar_url}
                alt=""
                className="w-14 h-14 rounded-full"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-xl font-bold text-teal-400">
                {(data.profile.display_name || data.profile.username || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-lg font-bold focus:outline-none focus:border-teal-400 w-full max-w-xs"
                    maxLength={100}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveDisplayName();
                      if (e.key === "Escape") setEditing(false);
                    }}
                  />
                  <button
                    onClick={saveDisplayName}
                    disabled={saving || !editName.trim()}
                    className="text-sm bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
                  >
                    {saving ? "..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="text-sm text-gray-500 hover:text-gray-300 px-2 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white">
                    {data.profile.display_name || data.profile.username || "Anonymous"}
                  </h1>
                  <button
                    onClick={() => {
                      setEditName(data.profile.display_name || data.profile.username || "");
                      setEditing(true);
                    }}
                    className="text-gray-600 hover:text-gray-400 transition-colors"
                    title="Edit display name"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                <span className="text-teal-400 font-semibold">{data.profile.total_xp} XP</span>
                {data.global_rank && <span>Rank #{data.global_rank}</span>}
                {data.streak_days > 0 && (
                  <span className="text-orange-400 inline-flex items-center gap-1">
                    {data.streak_days} day streak
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 23c-3.2 0-7-2.6-7-8 0-3.2 1.6-6.2 3.5-8.6.3-.4.9-.3 1.1.1.5 1 1.4 2.2 2.4 2.2.7 0 1.2-.4 1.5-1.2.4-1.1.5-2.5.5-4 0-.5.4-.8.8-.7C18 4 21 8.5 21 13.5 21 19.4 17.5 23 12 23z" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sectors */}
        <h2 className="text-lg font-bold text-white mb-4">My Sectors</h2>
        {data.favorites.length === 0 ? (
          <div className="text-center py-8 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-gray-400 mb-3">No sectors selected yet</p>
            <Link
              href="/profile/onboarding"
              className="text-teal-400 hover:text-teal-300 text-sm transition-colors"
            >
              Pick sectors &rarr;
            </Link>
          </div>
        ) : (
          <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.favorites.map((fav) => (
              <StaggerItem key={fav.sector_id}>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
                  <GaugeMeter score={fav.gauge_score} />
                  <div>
                    <h3 className="font-semibold text-white">{fav.sectors.name}</h3>
                    <p className="text-xs text-gray-500 capitalize">{fav.sectors.category}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        )}

        {/* Weekly Reports */}
        <h2 id="weekly-reports" className="text-lg font-bold text-white mb-4 mt-8">Weekly Reports</h2>
        <WeeklyReports token={session.access_token} />
      </div>
    </FadeInUp>
  );
}
