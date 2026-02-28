"use client";

interface LessonFallbackProps {
  summary: string | null;
  processing: boolean;
}

export default function LessonFallback({ summary, processing }: LessonFallbackProps) {
  if (processing) {
    return (
      <div className="space-y-4">
        <div className="h-8 skeleton-shimmer rounded w-3/4" />
        <div className="h-4 skeleton-shimmer rounded w-full" />
        <div className="h-4 skeleton-shimmer rounded w-5/6" />
        <div className="h-4 skeleton-shimmer rounded w-2/3" />
        <div className="h-32 skeleton-shimmer rounded" />
        <div className="h-32 skeleton-shimmer rounded" />
      </div>
    );
  }

  return (
    <div>
      {summary ? (
        <div className="prose prose-invert prose-sm max-w-none mb-6">
          {summary.split("\n").map((p, i) => (
            <p key={i} className="text-gray-300 leading-relaxed mb-4">{p}</p>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 mb-6">Summary not yet available.</p>
      )}

      <div className="glass rounded-xl p-5 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-teal-400 mb-1">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Being upgraded to full lesson
        </div>
        <p className="text-xs text-gray-500">
          This article is being re-processed with our enhanced lesson format.
        </p>
      </div>
    </div>
  );
}
