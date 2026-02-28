"use client";

import type { WhatHappened } from "@/types";
import SectionHeading from "./SectionHeading";

interface WhatHappenedSectionProps {
  data: WhatHappened;
}

export default function WhatHappenedSection({ data }: WhatHappenedSectionProps) {
  return (
    <section>
      <SectionHeading number="01" title="What Happened" />
      <div className="border-l-2 border-teal-400/40 pl-5 glass rounded-r-xl p-5">
        <ul className="space-y-2 mb-4">
          {data.event_bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-teal-400 mt-0.5 flex-shrink-0">&#8226;</span>
              {bullet}
            </li>
          ))}
        </ul>

        <div className="bg-teal-400/5 border border-teal-400/20 rounded-lg p-3 mb-3">
          <p className="text-sm font-medium text-teal-400">{data.market_question}</p>
        </div>

        {data.timing_note && (
          <p className="text-xs text-gray-500 italic">{data.timing_note}</p>
        )}
      </div>
    </section>
  );
}
