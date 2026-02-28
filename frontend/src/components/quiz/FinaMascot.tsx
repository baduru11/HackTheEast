"use client";

import { motion, AnimatePresence } from "framer-motion";

export type FinaExpression = "default" | "happy" | "angry";

interface FinaMascotProps {
  expression: FinaExpression;
}

const variants: Record<
  FinaExpression,
  { initial: object; animate: object; exit: object; transition: object }
> = {
  default: {
    initial: { scale: 0.7, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.7, opacity: 0 },
    transition: { duration: 0.25, ease: "easeOut" },
  },
  happy: {
    initial: { scale: 0, rotate: -20, opacity: 0 },
    animate: { scale: [0, 1.35, 0.95, 1.05, 1], rotate: [-20, 8, -4, 2, 0], opacity: 1 },
    exit: { scale: 0.7, opacity: 0 },
    transition: { duration: 0.5, times: [0, 0.45, 0.65, 0.8, 1] },
  },
  angry: {
    initial: { scale: 0, x: 0, opacity: 0 },
    animate: { scale: [0, 1.2, 1], x: [0, -8, 8, -5, 5, 0], opacity: 1 },
    exit: { scale: 0.7, opacity: 0 },
    transition: { duration: 0.55, times: [0, 0.35, 1] },
  },
};

export default function FinaMascot({ expression }: FinaMascotProps) {
  const v = variants[expression];

  return (
    <div
      className="fixed bottom-1/4 z-40 pointer-events-none select-none"
      style={{ right: "max(1rem, calc(50% - 35rem))" }}
    >
      {/* Floating wrapper — keeps bobbing regardless of expression swaps */}
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatType: "loop" }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={expression}
            src={`/fina/${expression}.webp`}
            alt="Fina"
            initial={v.initial}
            animate={v.animate}
            exit={v.exit}
            transition={v.transition}
            className="w-32 h-32 md:w-40 md:h-40 lg:w-56 lg:h-56 object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
          />
        </AnimatePresence>

        {/* Subtle glow ring on reaction */}
        <AnimatePresence>
          {expression !== "default" && (
            <motion.div
              key={expression + "-glow"}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1.6, opacity: [0, 0.35, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className={`absolute inset-0 rounded-full blur-xl -z-10 ${
                expression === "happy" ? "bg-green-400" : "bg-red-400"
              }`}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
