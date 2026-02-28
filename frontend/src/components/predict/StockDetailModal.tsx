"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PredictStock } from "@/types";

interface StockDetailModalProps {
  stock: PredictStock;
  onClose: () => void;
}

type RangeOption = "1D" | "7D" | "30D" | "90D";

interface ChartDataPoint {
  time: string;
  price: number;
}

export default function StockDetailModal({
  stock,
  onClose,
}: StockDetailModalProps) {
  const [range, setRange] = useState<RangeOption>("7D");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const ranges: RangeOption[] = ["1D", "7D", "30D", "90D"];

  useEffect(() => {
    setLoading(true);
    setError("");

    fetch(`/api/v1/predict/stock/${stock.ticker}/candles?range=${range}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.t && res.data.t.length > 0) {
          const points: ChartDataPoint[] = res.data.t.map(
            (time: number, i: number) => ({
              time:
                range === "1D"
                  ? new Date(time * 1000).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : new Date(time * 1000).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    }),
              price: res.data.c[i],
            })
          );
          setChartData(points);
        } else {
          const msg = res.error?.message || "No chart data available";
          setError(msg);
        }
      })
      .catch(() => {
        setError("Failed to load chart data");
      })
      .finally(() => setLoading(false));
  }, [stock.ticker, range]);

  const isPositive = stock.change_24h >= 0;

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-lg glass rounded-2xl p-6 glow-teal-sm z-10"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-white">{stock.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-400">{stock.ticker}</span>
            <span className="text-lg font-semibold text-white">
              ${stock.price.toFixed(2)}
            </span>
            <span
              className={`text-sm font-medium ${
                isPositive ? "text-green-400" : "text-red-400"
              }`}
            >
              {isPositive ? "+" : ""}
              {stock.change_24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Range tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-gray-800/50 rounded-lg w-fit">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                range === r
                  ? "bg-teal-500 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-56 w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-teal-400 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="priceGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={isPositive ? "#4ade80" : "#f87171"}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={isPositive ? "#4ade80" : "#f87171"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: "0.75rem",
                    fontSize: "0.75rem",
                    color: "#fff",
                  }}
                  formatter={(value: number | undefined) => [
                    `$${(value ?? 0).toFixed(2)}`,
                    "Price",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={isPositive ? "#4ade80" : "#f87171"}
                  strokeWidth={2}
                  fill="url(#priceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>
    </div>
  );
}
