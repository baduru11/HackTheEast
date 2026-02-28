"use client";

import { useState, useRef, useEffect } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { AnimatePresence, DropdownMotion } from "@/components/shared/MotionWrappers";
import type { Notification } from "@/types";

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

const NOTIF_CONFIG: Record<string, { icon: React.ReactNode; accent: string; bg: string }> = {
  new_article: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
    accent: "text-teal-400",
    bg: "bg-teal-400/10",
  },
  gauge_decay: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
    accent: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  achievement: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    accent: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  friend_request: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    accent: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  friend_accepted: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    accent: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
};

const DEFAULT_CONFIG = NOTIF_CONFIG.new_article;

const SECTOR_COLORS: Record<string, string> = {
  // Markets
  Crypto:          "text-orange-400 bg-orange-400/10 border border-orange-400/20",
  Stocks:          "text-blue-400 bg-blue-400/10 border border-blue-400/20",
  Options:         "text-violet-400 bg-violet-400/10 border border-violet-400/20",
  Bonds:           "text-slate-400 bg-slate-400/10 border border-slate-400/20",
  Currency:        "text-green-400 bg-green-400/10 border border-green-400/20",
  ETFs:            "text-cyan-400 bg-cyan-400/10 border border-cyan-400/20",
  "World Indices": "text-indigo-400 bg-indigo-400/10 border border-indigo-400/20",
  Sector:          "text-pink-400 bg-pink-400/10 border border-pink-400/20",
  // World
  Asia:            "text-rose-400 bg-rose-400/10 border border-rose-400/20",
  Americas:        "text-sky-400 bg-sky-400/10 border border-sky-400/20",
  Europe:          "text-blue-300 bg-blue-300/10 border border-blue-300/20",
  India:           "text-amber-400 bg-amber-400/10 border border-amber-400/20",
  China:           "text-red-400 bg-red-400/10 border border-red-400/20",
  Japan:           "text-fuchsia-400 bg-fuchsia-400/10 border border-fuchsia-400/20",
  War:             "text-red-500 bg-red-500/10 border border-red-500/20",
  // Fallback
  _default:        "text-teal-400 bg-teal-400/10 border border-teal-400/20",
};

function NotifIcon({ type }: { type: string }) {
  const config = NOTIF_CONFIG[type] || DEFAULT_CONFIG;
  return (
    <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${config.bg} ${config.accent} flex items-center justify-center`}>
      {config.icon}
    </div>
  );
}

function parseSectors(title: string): { label: string; sectors: string[] } {
  // "New in Crypto, Stocks" → { label: "New in", sectors: ["Crypto", "Stocks"] }
  // "New article in your sector" → { label: "New article in your sector", sectors: [] }
  const match = title.match(/^New in (.+)$/);
  if (match) {
    const sectors = match[1].split(",").map((s) => s.trim()).filter(Boolean);
    return { label: "New in", sectors };
  }
  return { label: title, sectors: [] };
}

function NotifItem({ n, onClose }: { n: Notification; onClose: () => void }) {
  const { label, sectors } = n.type === "new_article" ? parseSectors(n.title) : { label: n.title, sectors: [] };
  const config = NOTIF_CONFIG[n.type] || DEFAULT_CONFIG;

  return (
    <Link
      href={n.link || "#"}
      onClick={onClose}
      className={`group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04] ${
        !n.read ? "bg-teal-400/[0.04] border-l-2 border-l-teal-400" : "border-l-2 border-l-transparent"
      }`}
    >
      <NotifIcon type={n.type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className={`text-sm leading-snug ${!n.read ? "text-white font-medium" : "text-gray-300"}`}>
              {label}
            </span>
            {sectors.map((s) => (
              <span
                key={s}
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${SECTOR_COLORS[s] || SECTOR_COLORS._default}`}
              >
                {s}
              </span>
            ))}
          </div>
          {!n.read && (
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
        <p className="text-[10px] text-gray-600 mt-1">{timeAgo(n.created_at)}</p>
      </div>
    </Link>
  );
}

export default function NotificationBell() {
  const { user, session } = useAuth();
  const { notifications, unreadCount, setNotifications, setUnreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const markAllRead = async () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    await fetch(`${apiBase}/api/v1/notifications/read-all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${apiBase}/api/v1/notifications/all`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    }).catch(() => {});
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative text-gray-400 hover:text-white transition-colors p-1"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-teal-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-gray-900">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <DropdownMotion className="absolute right-0 top-full mt-2 w-[340px] rounded-xl shadow-2xl shadow-black/50 z-50 max-h-[460px] overflow-hidden bg-[#0f1420] border border-white/[0.08]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#131926]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-medium text-teal-400 bg-teal-400/10 px-1.5 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-gray-500 hover:text-teal-400 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto max-h-[380px] divide-y divide-white/[0.03]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-gray-800/60 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">All caught up</p>
                  <p className="text-xs text-gray-600 mt-0.5">No notifications yet</p>
                </div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <NotifItem key={n.id} n={n} onClose={() => setOpen(false)} />
                ))
              )}
            </div>
          </DropdownMotion>
        )}
      </AnimatePresence>
    </div>
  );
}
