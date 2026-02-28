import Link from "next/link";
import type { Article } from "@/types";

function timeAgo(date: string | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function TrendingGrid({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {articles.map((article) => (
        <Link
          key={article.id}
          href={`/article/${article.id}`}
          className="group bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-colors"
        >
          {article.image_url && (
            <img
              src={article.image_url}
              alt={article.headline}
              className="w-full h-32 object-cover"
            />
          )}
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span>{article.source_name}</span>
              <span>·</span>
              <span>{timeAgo(article.published_at)}</span>
            </div>
            <h3 className="text-sm font-semibold text-white leading-snug line-clamp-3 group-hover:text-teal-400 transition-colors">
              {article.headline}
            </h3>
          </div>
        </Link>
      ))}
    </div>
  );
}
