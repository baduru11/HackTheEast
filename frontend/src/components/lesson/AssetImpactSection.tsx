"use client";

import type { AssetImpact } from "@/types";
import SectionHeading from "./SectionHeading";

const directionConfig: Record<string, { icon: string; color: string }> = {
  up: { icon: "\u2191", color: "text-green-400" },
  down: { icon: "\u2193", color: "text-red-400" },
  neutral: { icon: "\u2194", color: "text-gray-400" },
  mixed: { icon: "\u21C5", color: "text-amber-400" },
};

const confidenceBadge: Record<string, string> = {
  High: "bg-green-500/15 text-green-400",
  Medium: "bg-yellow-500/15 text-yellow-400",
  Low: "bg-red-500/15 text-red-400",
};

interface AssetImpactSectionProps {
  assets: AssetImpact[];
}

export default function AssetImpactSection({ assets }: AssetImpactSectionProps) {
  return (
    <section>
      <SectionHeading number="04" title="Asset Impact Matrix" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {assets.map((asset, i) => {
          const dir = directionConfig[asset.direction] || directionConfig.neutral;
          const confClass = confidenceBadge[asset.confidence] || "bg-gray-800 text-gray-400";

          return (
            <div key={i} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-white">{asset.asset}</h4>
                <span className={`text-lg font-bold ${dir.color}`}>{dir.icon}</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{asset.typical_reaction}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                  {asset.mechanism_driver}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${confClass}`}>
                  {asset.confidence}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
