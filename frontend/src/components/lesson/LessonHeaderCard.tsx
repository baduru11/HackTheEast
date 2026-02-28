"use client";

import type { LessonHeader } from "@/types";

const difficultyColors: Record<string, string> = {
  Beginner: "bg-green-500/15 text-green-400 border-green-500/30",
  Intermediate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Advanced: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface LessonHeaderCardProps {
  header: LessonHeader;
}

export default function LessonHeaderCard({ header }: LessonHeaderCardProps) {
  const diffClass = difficultyColors[header.difficulty] || difficultyColors.Beginner;

  return (
    <div className="glass rounded-2xl p-6 glow-teal-sm">
      <h2 className="text-xl font-bold text-white mb-3">{header.lesson_title}</h2>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${diffClass}`}>
          {header.difficulty}
        </span>
        <span className="text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full">
          Core: {header.read_time_core_min} min
        </span>
        <span className="text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full">
          Deep: {header.read_time_deep_min} min
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {header.tags.map((tag) => (
          <span
            key={tag}
            className="text-xs text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mb-3">
        <p className="text-xs font-medium text-gray-400 mb-1.5">Learning Outcomes</p>
        <ul className="space-y-1">
          {header.learning_outcomes.map((outcome, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-teal-400 mt-0.5 flex-shrink-0">&#10003;</span>
              {outcome}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-gray-500 italic">{header.disclaimer}</p>
    </div>
  );
}
