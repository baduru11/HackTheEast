"use client";

import { useEffect, useState, useId } from "react";

interface GaugeMeterProps {
  score: number;
  size?: number;
  from?: number;
  delay?: number;
}

function getColors(score: number): [string, string] {
  if (score < 35) return ["#ef4444", "#f97316"]; // red → orange
  if (score < 65) return ["#f59e0b", "#eab308"]; // amber → yellow
  return ["#14b8a6", "#2dd4bf"]; // teal-500 → teal-400
}

export default function GaugeMeter({ score, size = 80, from = 0, delay = 0 }: GaugeMeterProps) {
  const uid = useId();
  const w = Math.round(size * 0.5);
  const h = size;
  const pad = 2;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const rx = iw / 2;

  const initial = Math.max(0, Math.min(100, from)) / 100;
  const [fill, setFill] = useState(initial);
  const target = Math.max(0, Math.min(100, score)) / 100;

  useEffect(() => {
    if (delay > 0) {
      const tid = setTimeout(() => setFill(target), delay);
      return () => clearTimeout(tid);
    }
    const id = requestAnimationFrame(() => setFill(target));
    return () => cancelAnimationFrame(id);
  }, [target, delay]);

  const fillH = fill * ih;
  const fillY = pad + ih - fillH;
  const [c1, c2] = getColors(score);

  // Primary wave path
  const amp = 3.5;
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

  // Secondary wave path (different frequency)
  const amp2 = 2.5;
  const segments2 = 6;
  const segW2 = totalW / segments2;
  let wave2 = `M${startX},0`;
  for (let i = 0; i < segments2; i++) {
    const cx = startX + segW2 * i + segW2 / 2;
    const cy = i % 2 === 0 ? -amp2 : amp2;
    const ex = startX + segW2 * (i + 1);
    wave2 += ` Q${cx},${cy} ${ex},0`;
  }
  wave2 += ` V${amp2 + 2} H${startX} Z`;

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
          {/* Liquid body — always in DOM so CSS transition can animate */}
          <rect
            x={pad}
            width={iw}
            fill={`url(#${gradId})`}
            style={{
              y: fill > 0 ? fillY : pad + ih,
              height: fill > 0 ? fillH + 1 : 0,
              transition: "y 1.2s cubic-bezier(0.34, 1.56, 0.64, 1), height 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          />

          {/* Primary wave on liquid surface */}
          {fill > 0 && fill < 1 && (
            <g style={{ transform: `translate(${pad + iw / 2}px, ${fillY}px)`, transition: "transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
              <g className="animate-gauge-wave">
                <path d={wave} fill={`url(#${gradId})`} />
              </g>
            </g>
          )}

          {/* Secondary wave — different frequency, offset phase */}
          {fill > 0 && fill < 1 && (
            <g style={{ transform: `translate(${pad + iw / 2}px, ${fillY + 1}px)`, transition: "transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }} opacity={0.35}>
              <g className="animate-gauge-wave-slow">
                <path d={wave2} fill={`url(#${gradId})`} />
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
