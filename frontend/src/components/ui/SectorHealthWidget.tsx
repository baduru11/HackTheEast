"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { Favorite } from "@/types";

function useDecayCountdown(): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    function tick() {
      const INTERVAL = 30 * 60 * 1000;
      const remaining = INTERVAL - (Date.now() % INTERVAL);
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setLabel(`${m}:${s.toString().padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return label;
}

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
  const [collapsed, setCollapsed] = useState(false);

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

  const handleClick = useCallback(
    (fav: Favorite) => {
      const base = fav.sectors.category === "world" ? "/world" : "/markets";
      router.push(`${base}/${fav.sectors.slug}`);
    },
    [router]
  );

  const decayCountdown = useDecayCountdown();

  // Hide conditions: profile page, not logged in, no favorites, still loading
  if (pathname.startsWith("/profile")) return null;
  if (authLoading || !session) return null;
  if (!loaded || favorites.length === 0) return null;

  // Sort lowest score first
  const sorted = [...favorites].sort((a, b) => a.gauge_score - b.gauge_score);

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72">
      {/* Fina mascot floating above the widget */}
      <AnimatePresence>
        {!collapsed && (
          <motion.img
            src="/fina/default.webp"
            alt="Fina"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: [0, -10, 0] }}
            exit={{ opacity: 0, y: 0 }}
            transition={{
              opacity: { duration: 0.3 },
              y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            }}
            className="absolute -top-24 right-1 w-24 h-24 object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)] pointer-events-none select-none brightness-110"
          />
        )}
      </AnimatePresence>

      <div className="glass rounded-xl overflow-hidden">
        {/* Header — always visible */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Sector Health
            </p>
            <span className="flex items-center gap-1 text-[10px] text-amber-400/80 font-mono">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {decayCountdown}
            </span>
          </div>
          <svg
            className="w-3.5 h-3.5 text-gray-500 transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Collapsible body */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-2 px-3 pb-3">
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
