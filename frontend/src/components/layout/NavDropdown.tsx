"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, DropdownMotion } from "@/components/shared/MotionWrappers";

interface NavDropdownProps {
  label: string;
  items: { name: string; slug: string }[];
  basePath: string;
}

export default function NavDropdown({ label, items, basePath }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-gray-300 hover:text-teal-400 transition-colors text-sm font-medium"
      >
        {label}
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <DropdownMotion className="absolute top-full left-0 mt-2 w-44 glass rounded-xl shadow-xl py-1 z-50">
            {items.map((item) => (
              <Link
                key={item.slug}
                href={`${basePath}/${item.slug}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg mx-1 transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </DropdownMotion>
        )}
      </AnimatePresence>
    </div>
  );
}
