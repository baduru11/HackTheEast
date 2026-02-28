"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import NavDropdown from "./NavDropdown";
import NotificationBell from "@/components/ui/NotificationBell";
import { AnimatePresence, DropdownMotion } from "@/components/shared/MotionWrappers";

const WORLD_SECTORS = [
  { name: "Asia", slug: "asia" },
  { name: "Americas", slug: "americas" },
  { name: "Europe", slug: "europe" },
  { name: "India", slug: "india" },
  { name: "China", slug: "china" },
  { name: "Japan", slug: "japan" },
  { name: "War", slug: "war" },
];

const MARKET_SECTORS = [
  { name: "Crypto", slug: "crypto" },
  { name: "Stocks", slug: "stocks" },
  { name: "Options", slug: "options" },
  { name: "Bonds", slug: "bonds" },
  { name: "Currency", slug: "currency" },
  { name: "ETFs", slug: "etfs" },
  { name: "World Indices", slug: "indices" },
  { name: "Sector", slug: "sector" },
];

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white tracking-tight">
            <Image src="/img/fina.png" alt="FinaMeter" width={32} height={32} className="rounded-md" />
            <span>Fina<span className="text-teal-400" style={{ textShadow: "0 0 12px rgba(45, 212, 191, 0.4)" }}>Meter</span></span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <NavDropdown label="World" items={WORLD_SECTORS} basePath="/world" />
            <NavDropdown label="Markets" items={MARKET_SECTORS} basePath="/markets" />
            <Link
              href="/feed"
              className="text-gray-300 hover:text-teal-400 transition-colors text-sm font-medium"
            >
              Feed
            </Link>
            <Link
              href="/daily-quiz"
              className="text-gray-300 hover:text-teal-400 transition-colors text-sm font-medium"
            >
              Daily Quiz
            </Link>
            <Link
              href="/predict"
              className="text-gray-300 hover:text-teal-400 transition-colors text-sm font-medium"
            >
              Predict
            </Link>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/social"
            className="text-gray-300 hover:text-teal-400 transition-colors text-sm font-medium"
          >
            Social
          </Link>
          <Link
            href="/leaderboard"
            className="text-gray-300 hover:text-teal-400 transition-colors text-sm font-medium"
          >
            Leaderboard
          </Link>
          <NotificationBell />
          {!loading && (
            user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/profile"
                  className="text-gray-300 hover:text-teal-400 transition-colors text-sm font-medium"
                >
                  Profile
                </Link>
                <button
                  onClick={signOut}
                  className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                Sign in
              </Link>
            )
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-gray-300"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <DropdownMotion className="md:hidden glass border-t border-white/5 px-4 py-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">World</p>
              <div className="grid grid-cols-2 gap-1">
                {WORLD_SECTORS.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/world/${s.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm text-gray-300 hover:text-teal-400 py-1"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Markets</p>
              <div className="grid grid-cols-2 gap-1">
                {MARKET_SECTORS.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/markets/${s.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm text-gray-300 hover:text-teal-400 py-1"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-800 pt-3">
              <Link
                href="/feed"
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-gray-300 hover:text-teal-400 py-1"
              >
                Feed
              </Link>
              <Link
                href="/social"
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-gray-300 hover:text-teal-400 py-1"
              >
                Social
              </Link>
              <Link
                href="/leaderboard"
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-gray-300 hover:text-teal-400 py-1"
              >
                Leaderboard
              </Link>
              <Link
                href="/daily-quiz"
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-gray-300 hover:text-teal-400 py-1"
              >
                Daily Quiz
              </Link>
              <Link
                href="/predict"
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-gray-300 hover:text-teal-400 py-1"
              >
                Predict
              </Link>
              {user ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="block text-sm text-gray-300 hover:text-teal-400 py-1"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => { signOut(); setMobileOpen(false); }}
                    className="block text-sm text-gray-500 hover:text-gray-300 py-1"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm text-teal-400 py-1"
                >
                  Sign in
                </Link>
              )}
            </div>
          </DropdownMotion>
        )}
      </AnimatePresence>
    </nav>
  );
}
