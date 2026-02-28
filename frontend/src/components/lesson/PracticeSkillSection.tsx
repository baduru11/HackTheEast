"use client";

import type { PracticeSkill } from "@/types";
import SectionHeading from "./SectionHeading";

interface PracticeSkillSectionProps {
  data: PracticeSkill;
}

export default function PracticeSkillSection({ data }: PracticeSkillSectionProps) {
  return (
    <section>
      <SectionHeading number="05" title="Practice Skill" />
      <div className="glass rounded-xl p-5">
        <h4 className="text-sm font-semibold text-white mb-3">{data.skill_target}</h4>

        <div className="flex items-center gap-2 mb-4 text-xs">
          <span className="text-gray-500">Inputs:</span>
          <span className="text-gray-300">{data.inputs}</span>
          {data.level_zone && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-gray-500">Level/Zone:</span>
              <span className="text-teal-400">{data.level_zone}</span>
            </>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <div className="bg-green-950/20 border border-green-800/30 rounded-lg p-3">
            <p className="text-[10px] font-medium text-green-400 mb-1">Scenario A</p>
            <p className="text-xs text-gray-300">{data.scenario_a}</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/30 rounded-lg p-3">
            <p className="text-[10px] font-medium text-red-400 mb-1">Scenario B</p>
            <p className="text-xs text-gray-300">{data.scenario_b}</p>
          </div>
        </div>

        <div className="bg-teal-400/5 border border-teal-400/20 rounded-lg p-3">
          <p className="text-[10px] font-medium text-teal-400 mb-1">What to watch</p>
          <p className="text-xs text-gray-300">{data.what_to_watch}</p>
        </div>
      </div>
    </section>
  );
}
