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

export default function HeroCard({ article }: { article: Article }) {
  return (
    <Link href={`/article/${article.id}`} className="block group">
      <div className="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-800 h-80">
        {article.image_url && (
          <img
            src={article.image_url}
            alt={article.headline}
            className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <span className="text-teal-400 font-medium">{article.source_name}</span>
            <span>·</span>
            <span>{timeAgo(article.published_at)}</span>
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight group-hover:text-teal-400 transition-colors">
            {article.headline}
          </h2>
          {article.snippet && (
            <p className="text-gray-400 mt-2 line-clamp-2 text-sm">{article.snippet}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
