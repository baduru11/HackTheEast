"use client";

import { useEffect, useState, useId } from "react";

interface GaugeMeterProps {
  score: number;
  size?: number;
}

function getColors(score: number): [string, string] {
  if (score < 35) return ["#ef4444", "#f97316"]; // red → orange
  if (score < 65) return ["#f59e0b", "#eab308"]; // amber → yellow
  return ["#14b8a6", "#2dd4bf"]; // teal-500 → teal-400
}

export default function GaugeMeter({ score, size = 80 }: GaugeMeterProps) {
  const uid = useId();
  const w = Math.round(size * 0.5);
  const h = size;
  const pad = 2;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const rx = iw / 2;

  const [fill, setFill] = useState(0);
  const target = Math.max(0, Math.min(100, score)) / 100;

  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const fillH = fill * ih;
  const fillY = pad + ih - fillH;
  const [c1, c2] = getColors(score);

  // Wave path: sine wave wider than tube for seamless horizontal drift
  const amp = 2;
  const segments = 8;
  const totalW = iw * 2;
  const segW = totalW / segments;
  const startX = -iw / 2;
  let wave = `M${startX},0`;
  for (let i = 0; i < segments; i++) {
    const cx = startX + segW * i + segW / 2;
    const cy = i % 2 === 0 ? -amp : amp;
    const ex = startX + segW * (i + 1);
    wave += ` Q${cx},${cy} ${ex},0`;
  }
  wave += ` V${amp + 2} H${startX} Z`;

  const clipId = CSS.escape(`${uid}-c`);
  const gradId = CSS.escape(`${uid}-g`);

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: w }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={pad} y={pad} width={iw} height={ih} rx={rx} />
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>

        {/* Tube background */}
        <rect x={pad} y={pad} width={iw} height={ih} rx={rx} fill="#0f172a" stroke="#1e293b" strokeWidth={1.5} />

        {/* Clipped liquid + wave */}
        <g clipPath={`url(#${clipId})`}>
          {/* Liquid body */}
          {fill > 0 && (
            <rect
              x={pad}
              y={fillY}
              width={iw}
              height={fillH + 1}
              fill={`url(#${gradId})`}
              style={{ transition: "y 1s ease-out, height 1s ease-out" }}
            />
          )}

          {/* Wave on liquid surface */}
          {fill > 0 && fill < 1 && (
            <g style={{ transform: `translate(${pad + iw / 2}px, ${fillY}px)`, transition: "transform 1s ease-out" }}>
              <g className="animate-gauge-wave">
                <path d={wave} fill={`url(#${gradId})`} />
              </g>
            </g>
          )}
        </g>

        {/* Glass highlight reflection */}
        <rect
          x={pad + iw * 0.22}
          y={pad + 6}
          width={iw * 0.14}
          height={ih * 0.35}
          rx={iw * 0.07}
          fill="white"
          opacity={0.06}
        />

        {/* Tube border overlay */}
        <rect x={pad} y={pad} width={iw} height={ih} rx={rx} fill="none" stroke="#1e293b" strokeWidth={1.5} />
      </svg>

      {/* Score label */}
      <span className="text-[11px] font-bold text-white mt-1">{score}</span>
    </div>
  );
}
