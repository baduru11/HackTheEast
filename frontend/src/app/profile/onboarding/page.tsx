"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

const ALL_SECTORS = [
  { id: 1, name: "Asia", category: "world" },
  { id: 2, name: "Americas", category: "world" },
  { id: 3, name: "Europe", category: "world" },
  { id: 4, name: "India", category: "world" },
  { id: 5, name: "China", category: "world" },
  { id: 6, name: "Japan", category: "world" },
  { id: 7, name: "War", category: "world" },
  { id: 8, name: "Crypto", category: "markets" },
  { id: 9, name: "Stocks", category: "markets" },
  { id: 10, name: "Options", category: "markets" },
  { id: 11, name: "Bonds", category: "markets" },
  { id: 12, name: "Currency", category: "markets" },
  { id: 13, name: "ETFs", category: "markets" },
  { id: 14, name: "World Indices", category: "markets" },
  { id: 15, name: "Sector", category: "markets" },
];

export default function OnboardingPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleContinue = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setError("");

    let failed = 0;
    for (const sectorId of selected) {
      try {
        const res = await apiFetch("/favorites", {
          method: "POST",
          token: session?.access_token,
          body: JSON.stringify({ sector_id: sectorId }),
        });
        if (!res.success) failed++;
      } catch {
        failed++;
      }
    }

    if (failed > 0) {
      setError(`Failed to save ${failed} sector(s). Please try again.`);
      setSaving(false);
      return;
    }

    router.push("/profile");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Pick your sectors</h1>
        <p className="text-gray-400">
          Choose the financial sectors you want to track. You can change these later.
        </p>
      </div>

      <div className="mb-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">World</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ALL_SECTORS.filter((s) => s.category === "world").map((s) => (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                selected.has(s.id)
                  ? "border-teal-400 bg-teal-400/10 text-teal-400"
                  : "border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Markets</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ALL_SECTORS.filter((s) => s.category === "markets").map((s) => (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                selected.has(s.id)
                  ? "border-teal-400 bg-teal-400/10 text-teal-400"
                  : "border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center mb-3">{error}</p>
      )}

      <button
        onClick={handleContinue}
        disabled={selected.size === 0 || saving}
        className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {saving ? "Saving..." : `Continue with ${selected.size} sector${selected.size !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
