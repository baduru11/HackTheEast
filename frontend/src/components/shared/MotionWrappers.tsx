"use client";

import { ReactNode } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";

export { AnimatePresence };

interface FadeInUpProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function FadeInUp({ children, delay = 0, className }: FadeInUpProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerList({ children, className, staggerDelay = 0.06 }: StaggerListProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface DropdownMotionProps {
  children: ReactNode;
  className?: string;
}

export function DropdownMotion({ children, className }: DropdownMotionProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
