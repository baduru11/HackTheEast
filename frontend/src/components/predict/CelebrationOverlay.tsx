"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CelebrationOverlayProps {
  show: boolean;
  onComplete: () => void;
  duration?: number;
}

export default function CelebrationOverlay({
  show,
  onComplete,
  duration = 3000,
}: CelebrationOverlayProps) {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onComplete, duration);
    return () => clearTimeout(timer);
  }, [show, duration, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onComplete}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="glass rounded-2xl p-10 text-center glow-teal-sm max-w-sm mx-4"
          >
            <div className="text-5xl mb-4">&#127881;</div>
            <h2 className="text-xl font-bold text-white mb-2">
              Prediction Placed!
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Nice call! Check back at market close to see your result.
            </p>
            <div className="inline-flex items-center gap-1.5 bg-teal-400/10 px-4 py-2 rounded-lg">
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="text-sm font-medium text-teal-400">
                +50 XP on win
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
