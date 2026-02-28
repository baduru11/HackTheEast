"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ConceptCard } from "@/types";
import SectionHeading from "./SectionHeading";

interface ConceptCardsSectionProps {
  cards: ConceptCard[];
}

function ConceptCardItem({ card }: { card: ConceptCard }) {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left glass rounded-xl p-4 hover:border-teal-400/20 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-white mb-1">{card.concept}</h4>
          <p className="text-xs text-gray-400">{card.plain_meaning}</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <AnimatePresence>
        {expanded && (
          reduced ? (
            <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
              <Detail label="Why it moves prices" value={card.why_it_moves_prices} />
              <Detail label="In this article" value={card.in_this_article} />
              <Detail label="Common confusion" value={card.common_confusion} />
            </div>
          ) : (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
                <Detail label="Why it moves prices" value={card.why_it_moves_prices} />
                <Detail label="In this article" value={card.in_this_article} />
                <Detail label="Common confusion" value={card.common_confusion} />
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-500">{label}:</span>
      <p className="text-xs text-gray-300 mt-0.5">{value}</p>
    </div>
  );
}

export default function ConceptCardsSection({ cards }: ConceptCardsSectionProps) {
  return (
    <section>
      <SectionHeading number="02" title="Key Concepts" />
      <div className="grid gap-3">
        {cards.map((card, i) => (
          <ConceptCardItem key={i} card={card} />
        ))}
      </div>
    </section>
  );
}
