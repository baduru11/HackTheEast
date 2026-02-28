"use client";

import { useEffect, useState, useId } from "react";

interface GaugeMeterProps {
  score: number;
  size?: number;
}

function getGradientColors(score: number): [string, string] {
  if (score < 35) return ["#ef4444", "#f97316"]; // red → orange
  if (score < 65) return ["#f59e0b", "#eab308"]; // amber → yellow
  return ["#14b8a6", "#2dd4bf"]; // teal-500 → teal-400
}

export default function GaugeMeter({ score, size = 80 }: GaugeMeterProps) {
  const gradientId = useId();
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 100) * circumference;
  const [offset, setOffset] = useState(circumference);
  const [start, end] = getGradientColors(score);

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setOffset(targetOffset);
    });
    return () => cancelAnimationFrame(timer);
  }, [targetOffset]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={start} />
            <stop offset="100%" stopColor={end} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${CSS.escape(gradientId)})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <span className="absolute text-sm font-bold text-white">{score}</span>
    </div>
  );
}
