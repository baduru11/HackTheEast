import Link from "next/link";
import type { Article } from "@/types";
import SectorTags from "@/components/shared/SectorTags";
import ArticleImage from "@/components/shared/ArticleImage";

function timeAgo(date: string | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/article/${article.id}`}
      className="flex gap-4 p-4 rounded-lg bg-gray-900 border border-gray-800 transition-all duration-300 hover:border-teal-400/20 hover:bg-gray-900/80 hover:glow-teal-sm hover:scale-[1.01] group"
    >
      <div className="w-28 h-20 rounded-md overflow-hidden flex-shrink-0">
        <ArticleImage
          src={article.image_url}
          alt=""
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-teal-400 transition-colors">
          {article.headline}
        </h3>
        {article.snippet && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{article.snippet}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-2 flex-wrap">
          <span>{article.source_name}</span>
          <span>·</span>
          <span>{timeAgo(article.published_at)}</span>
          <SectorTags article={article} max={2} />
        </div>
      </div>
    </Link>
  );
}
