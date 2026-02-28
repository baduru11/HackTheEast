"use client";

import { useState } from "react";

interface ArticleImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
}

const BROKEN_PATTERNS = [
  "s.yimg.com",
  "media.zenfs.com",
  "static.finnhub.io",
  "static2.finnhub.io",
];

function isBrokenUrl(url: string): boolean {
  return BROKEN_PATTERNS.some((p) => url.includes(p));
}

export default function ArticleImage({ src, alt, className = "" }: ArticleImageProps) {
  const [error, setError] = useState(false);

  if (!src || error || isBrokenUrl(src)) {
    return (
      <div className={`bg-gray-800 flex items-center justify-center ${className}`}>
        <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setError(true)}
    />
  );
}
