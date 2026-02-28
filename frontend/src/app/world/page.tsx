import Link from "next/link";
import { StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";

const SECTORS = [
  { name: "Asia", slug: "asia", desc: "East & Southeast Asian markets and economies" },
  { name: "Americas", slug: "americas", desc: "North & South American financial news" },
  { name: "Europe", slug: "europe", desc: "European markets, ECB, and trade" },
  { name: "India", slug: "india", desc: "Indian economy, BSE, and NSE coverage" },
  { name: "China", slug: "china", desc: "Chinese markets, trade, and tech" },
  { name: "Japan", slug: "japan", desc: "Japanese economy, BOJ, and Nikkei" },
  { name: "War", slug: "war", desc: "Conflicts, sanctions, and economic impact" },
];

export default function WorldPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">World</h1>
      <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTORS.map((s) => (
          <StaggerItem key={s.slug}>
            <Link
              href={`/world/${s.slug}`}
              className="block p-5 bg-gray-900 border border-gray-800 rounded-xl transition-all duration-300 hover:border-teal-400/20 hover:bg-gray-900/80 hover:scale-[1.02] hover:glow-teal-sm group"
            >
              <h2 className="text-lg font-semibold text-white group-hover:text-teal-400 transition-colors">
                {s.name}
              </h2>
              <p className="text-sm text-gray-400 mt-1">{s.desc}</p>
            </Link>
          </StaggerItem>
        ))}
      </StaggerList>
    </div>
  );
}
