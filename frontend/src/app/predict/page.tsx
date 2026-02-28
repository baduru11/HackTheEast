"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { FadeInUp, StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";
import StockPredictionCard from "@/components/predict/StockPredictionCard";
import PredictionHistory from "@/components/predict/PredictionHistory";
import StockDetailModal from "@/components/predict/StockDetailModal";
import CelebrationOverlay from "@/components/predict/CelebrationOverlay";
import type { PredictStock, Prediction } from "@/types";

export default function PredictPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [stocks, setStocks] = useState<PredictStock[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [detailStock, setDetailStock] = useState<PredictStock | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [error, setError] = useState("");

  // Fetch today's stocks
  useEffect(() => {
    fetch("/api/v1/predict/today")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.stocks) {
          setStocks(res.data.stocks);
        }
      })
      .catch(() => setError("Failed to load stocks"))
      .finally(() => setLoadingStocks(false));
  }, []);

  // Fetch user's predictions
  const fetchPredictions = useCallback(() => {
    if (!session?.access_token) return;
    setLoadingPredictions(true);
    fetch("/api/v1/predict/my-predictions", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setPredictions(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingPredictions(false));
  }, [session?.access_token]);

  useEffect(() => {
    if (session?.access_token) {
      fetchPredictions();
    }
  }, [session?.access_token, fetchPredictions]);

  // Handle prediction
  const handlePredict = async (ticker: string, direction: "up" | "down") => {
    if (!session?.access_token) return;

    const stock = stocks.find((s) => s.ticker === ticker);
    if (!stock) return;

    try {
      const res = await fetch("/api/v1/predict/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ticker,
          direction,
          price_at_bet: stock.price,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCelebration(true);
        fetchPredictions();
      } else {
        setError(data.error?.message || "Failed to place prediction");
      }
    } catch {
      setError("Failed to place prediction");
    }
  };

  // Set of tickers user already predicted today
  const predictedTickers = new Set(
    predictions
      .filter((p) => p.result === "pending")
      .map((p) => p.ticker)
  );

  // Loading state
  if (authLoading || loadingStocks) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="h-8 skeleton-shimmer rounded w-40 mb-2" />
          <div className="h-4 skeleton-shimmer rounded w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-44 skeleton-shimmer rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <FadeInUp>
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <div className="glass rounded-2xl p-10 glow-teal-sm">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-teal-400/10 flex items-center justify-center">
              <svg
                className="w-7 h-7 text-teal-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              Sign in to make predictions
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              Predict stock movements and earn XP
            </p>
            <Link
              href="/login"
              className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-medium px-8 py-2.5 rounded-xl transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </FadeInUp>
    );
  }

  return (
    <>
      <FadeInUp>
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Hero */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Predict</h1>
            <p className="text-sm text-gray-400">
              Pick a direction for today&apos;s stocks. Correct predictions earn{" "}
              <span className="text-teal-400 font-medium">+50 XP</span>.
              Results settle at market close.
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-6 p-3 rounded-xl border border-red-800/50 bg-red-400/10 text-sm text-red-400 flex items-center gap-2">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <span>{error}</span>
              <button
                onClick={() => setError("")}
                className="ml-auto text-red-400 hover:text-red-300"
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
            </div>
          )}

          {/* Stock cards grid */}
          {stocks.length > 0 ? (
            <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
              {stocks.map((stock) => (
                <StaggerItem key={stock.ticker}>
                  <StockPredictionCard
                    stock={stock}
                    onPredict={handlePredict}
                    hasPredicted={predictedTickers.has(stock.ticker)}
                    onViewDetail={setDetailStock}
                  />
                </StaggerItem>
              ))}
            </StaggerList>
          ) : (
            <div className="glass rounded-2xl p-8 text-center mb-12">
              <p className="text-sm text-gray-400">
                No stocks available for prediction today. Check back later.
              </p>
            </div>
          )}

          {/* Prediction History */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">
              Your Predictions
            </h2>
            {loadingPredictions ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 skeleton-shimmer rounded-xl" />
                ))}
              </div>
            ) : (
              <PredictionHistory predictions={predictions} />
            )}
          </div>
        </div>
      </FadeInUp>

      {/* Stock Detail Modal */}
      <AnimatePresence>
        {detailStock && (
          <StockDetailModal
            stock={detailStock}
            onClose={() => setDetailStock(null)}
          />
        )}
      </AnimatePresence>

      {/* Celebration Overlay */}
      <CelebrationOverlay
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />
    </>
  );
}
