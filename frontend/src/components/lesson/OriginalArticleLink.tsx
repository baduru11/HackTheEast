"use client";

interface OriginalArticleLinkProps {
  url: string;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "article";
  }
}

export default function OriginalArticleLink({ url }: OriginalArticleLinkProps) {
  const domain = getDomain(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 p-4 rounded-xl glass glow-teal-sm hover:border-teal-400/30 transition-all"
    >
      <div className="flex-1">
        <p className="text-xs text-gray-400 mb-0.5">Original article</p>
        <p className="text-sm font-medium text-teal-400 group-hover:text-teal-300 transition-colors">
          {domain}
        </p>
      </div>
      <svg
        className="w-4 h-4 text-gray-500 group-hover:text-teal-400 transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </a>
  );
}
