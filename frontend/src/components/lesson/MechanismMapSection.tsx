"use client";

import type { MechanismMap } from "@/types";
import SectionHeading from "./SectionHeading";

const confidenceColors: Record<string, string> = {
  High: "text-green-400",
  Medium: "text-yellow-400",
  Low: "text-red-400",
};

const relationshipColors: Record<string, string> = {
  causal: "bg-teal-400/15 text-teal-400 border-teal-400/30",
  correlational: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  assumption: "bg-amber-400/15 text-amber-400 border-amber-400/30",
};

function StrengthDots({ strength }: { strength: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= strength ? "bg-teal-400" : "bg-gray-700"}`}
        />
      ))}
    </div>
  );
}

interface MechanismMapSectionProps {
  data: MechanismMap;
}

export default function MechanismMapSection({ data }: MechanismMapSectionProps) {
  return (
    <section>
      <SectionHeading number="03" title="Mechanism Map" />

      {/* 3A: Transmission Table */}
      <div className="mb-6">
        <p className="text-xs font-medium text-gray-400 mb-2">Transmission Channels</p>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium">Shock</th>
                <th className="text-left py-2 pr-3 font-medium">Channel</th>
                <th className="text-left py-2 pr-3 font-medium">Market Variable</th>
                <th className="text-left py-2 pr-3 font-medium">Asset Impact</th>
                <th className="text-left py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {data.transmission_table.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td className="py-2.5 pr-3 text-gray-300">{row.shock}</td>
                  <td className="py-2.5 pr-3 text-gray-300">{row.channel}</td>
                  <td className="py-2.5 pr-3 text-gray-300">{row.market_variable}</td>
                  <td className="py-2.5 pr-3 text-gray-300">{row.asset_impact}</td>
                  <td className={`py-2.5 font-medium ${confidenceColors[row.confidence] || "text-gray-400"}`}>
                    {row.confidence}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3B: Edge List */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-2">Causal Relationships</p>
        <div className="space-y-2">
          {data.edge_list.map((edge, i) => (
            <div key={i} className="glass rounded-lg p-3 flex items-center gap-3 flex-wrap">
              <span className="text-xs text-white font-medium">{edge.from_node}</span>
              <span className="text-teal-400 text-xs">&#8594;</span>
              <span className="text-xs text-white font-medium">{edge.to_node}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${relationshipColors[edge.relationship] || "bg-gray-800 text-gray-400 border-gray-700"}`}>
                {edge.relationship}
              </span>
              <StrengthDots strength={edge.strength} />
              <p className="w-full text-xs text-gray-400 mt-1">{edge.evidence}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
