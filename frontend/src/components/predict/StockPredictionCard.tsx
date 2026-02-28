"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PredictStock } from "@/types";

interface StockPredictionCardProps {
  stock: PredictStock;
  onPredict: (ticker: string, direction: "up" | "down") => void;
  hasPredicted: boolean;
  onViewDetail: (stock: PredictStock) => void;
}

export default function StockPredictionCard({
  stock,
  onPredict,
  hasPredicted,
  onViewDetail,
}: StockPredictionCardProps) {
  const [confirming, setConfirming] = useState<"up" | "down" | null>(null);
  const isPositive = stock.change_24h >= 0;

  const handleDirectionClick = (direction: "up" | "down") => {
    if (hasPredicted) return;
    setConfirming(direction);
  };

  const handleConfirm = () => {
    if (!confirming) return;
    onPredict(stock.ticker, confirming);
    setConfirming(null);
  };

  const handleCancel = () => {
    setConfirming(null);
  };

  return (
    <div className="glass rounded-2xl p-5 glow-teal-sm flex flex-col">
      {/* Header - clickable for detail */}
      <button
        onClick={() => onViewDetail(stock)}
        className="text-left w-full mb-4 group"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-white group-hover:text-teal-400 transition-colors">
              {stock.ticker}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
              {stock.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-base font-semibold text-white">
              ${stock.price.toFixed(2)}
            </p>
            <p
              className={`text-xs font-medium mt-0.5 ${
                isPositive ? "text-green-400" : "text-red-400"
              }`}
            >
              {isPositive ? "+" : ""}
              {stock.change_24h.toFixed(2)}%
            </p>
          </div>
        </div>
      </button>

      {/* Action area */}
      <div className="mt-auto">
        <AnimatePresence mode="wait">
          {hasPredicted ? (
            <motion.div
              key="predicted"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-400/10 border border-teal-800/50"
            >
              <svg
                className="w-4 h-4 text-teal-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm font-medium text-teal-400">
                Prediction placed — awaiting result
              </span>
            </motion.div>
          ) : confirming ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              <p className="text-xs text-gray-400 text-center">
                Predict {stock.ticker} going{" "}
                <span
                  className={
                    confirming === "up" ? "text-green-400" : "text-red-400"
                  }
                >
                  {confirming === "up" ? "up" : "down"}
                </span>
                ?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-2 rounded-lg border border-gray-800 text-sm text-gray-400 hover:text-white hover:border-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                    confirming === "up"
                      ? "bg-green-500 hover:bg-green-400"
                      : "bg-red-500 hover:bg-red-400"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="buttons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-2"
            >
              <button
                onClick={() => handleDirectionClick("up")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-green-800/50 bg-green-400/10 text-green-400 text-sm font-medium hover:bg-green-400/20 transition-colors"
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
                    d="M5 15l7-7 7 7"
                  />
                </svg>
                Going Up
              </button>
              <button
                onClick={() => handleDirectionClick("down")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-800/50 bg-red-400/10 text-red-400 text-sm font-medium hover:bg-red-400/20 transition-colors"
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
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                Going Down
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
