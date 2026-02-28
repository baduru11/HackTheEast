"use client";

import { useState, useRef, useEffect } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { AnimatePresence, DropdownMotion } from "@/components/shared/MotionWrappers";

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
    await fetch("/api/v1/notifications/read-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative text-gray-400 hover:text-white transition-colors"
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
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <DropdownMotion className="absolute right-0 top-full mt-2 w-80 glass rounded-xl shadow-xl z-50 max-h-96 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-sm font-semibold text-white">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-72">
              {notifications.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">No notifications</p>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <Link
                    key={n.id}
                    href={n.link || "#"}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${
                      !n.read ? "bg-teal-400/5" : ""
                    }`}
                  >
                    <p className="text-sm text-white font-medium">{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{n.body}</p>
                  </Link>
                ))
              )}
            </div>
          </DropdownMotion>
        )}
      </AnimatePresence>
    </div>
  );
}
