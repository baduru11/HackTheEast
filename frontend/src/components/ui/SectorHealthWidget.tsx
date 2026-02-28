"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { Favorite } from "@/types";

function barColor(score: number): string {
  if (score < 34) return "bg-red-500";
  if (score < 67) return "bg-amber-400";
  return "bg-teal-400";
}

function barTrackGlow(score: number): string {
  if (score < 34) return "shadow-[0_0_6px_rgba(239,68,68,0.3)]";
  if (score < 67) return "shadow-[0_0_6px_rgba(251,191,36,0.25)]";
  return "shadow-[0_0_6px_rgba(45,212,191,0.25)]";
}

const CATEGORY_COLORS: Record<string, string> = {
  world: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  markets: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};
const FALLBACK_COLOR = "bg-gray-500/15 text-gray-400 border-gray-500/20";

export default function SectorHealthWidget() {
  const { session, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(true);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch favorites
  useEffect(() => {
    if (authLoading || !session) return;
    apiFetch<Favorite[]>("/favorites", { token: session.access_token })
      .then((res) => {
        if (res.success && res.data) setFavorites(res.data);
      })
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, [session, authLoading]);

  // Scroll-based auto-hide
  useEffect(() => {
    const onScroll = () => {
      setVisible(false);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setVisible(true), 1000);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  const handleClick = useCallback(
    (fav: Favorite) => {
      const base = fav.sectors.category === "world" ? "/world" : "/markets";
      router.push(`${base}/${fav.sectors.slug}`);
    },
    [router]
  );

  // Hide conditions: profile page, not logged in, no favorites, still loading
  if (pathname.startsWith("/profile")) return null;
  if (authLoading || !session) return null;
  if (!loaded || favorites.length === 0) return null;

  // Sort lowest score first
  const sorted = [...favorites].sort((a, b) => a.gauge_score - b.gauge_score);

  return (
    <div
      className="fixed bottom-4 right-4 z-40 w-72 glass rounded-xl p-3 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
    >
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Sector Health
      </p>

      <div className="space-y-2">
        {sorted.map((fav) => (
          <button
            key={fav.sector_id}
            onClick={() => handleClick(fav)}
            className="w-full flex items-center gap-2 group hover:bg-white/[0.03] rounded-md px-1 py-0.5 transition-colors"
          >
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border w-24 text-center truncate shrink-0 ${
                CATEGORY_COLORS[fav.sectors.category] || FALLBACK_COLOR
              }`}
            >
              {fav.sectors.name}
            </span>
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor(fav.gauge_score)} ${barTrackGlow(fav.gauge_score)}`}
                style={{ width: `${Math.max(2, fav.gauge_score)}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 w-6 text-right font-mono">
              {fav.gauge_score}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
