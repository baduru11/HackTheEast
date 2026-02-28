"use client";

import { StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";
import type { Prediction } from "@/types";

interface PredictionHistoryProps {
  predictions: Prediction[];
}

export default function PredictionHistory({ predictions }: PredictionHistoryProps) {
  if (predictions.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-400">No predictions yet</p>
        <p className="text-xs text-gray-500 mt-1">
          Pick a stock above to make your first prediction
        </p>
      </div>
    );
  }

  return (
    <StaggerList className="space-y-3">
      {predictions.map((pred) => (
        <StaggerItem key={pred.id}>
          <div className="glass rounded-xl p-4 flex items-center justify-between">
            {/* Left: ticker + direction */}
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  pred.direction === "up"
                    ? "bg-green-400/10"
                    : "bg-red-400/10"
                }`}
              >
                {pred.direction === "up" ? (
                  <svg
                    className="w-4 h-4 text-green-400"
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
                ) : (
                  <svg
                    className="w-4 h-4 text-red-400"
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
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {pred.ticker}
                </p>
                <p className="text-xs text-gray-400">
                  ${pred.price_at_bet.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Right: result */}
            <div className="flex items-center gap-2">
              {pred.result === "win" ? (
                <>
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-green-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-green-400">
                    +50 XP
                  </span>
                </>
              ) : pred.result === "loss" ? (
                <>
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-red-400">
                    0 XP
                  </span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-gray-400"
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
                  </div>
                  <span className="text-xs font-medium text-gray-400">
                    Awaiting
                  </span>
                </>
              )}
            </div>
          </div>
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
