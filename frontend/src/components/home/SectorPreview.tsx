import Link from "next/link";
import type { Article } from "@/types";
import SectorTags from "@/components/shared/SectorTags";

function timeAgo(date: string | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface SectorPreviewProps {
  title: string;
  href: string;
  articles: Article[];
}

export default function SectorPreview({ title, href, articles }: SectorPreviewProps) {
  if (!articles.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <Link href={href} className="text-sm text-teal-400 hover:text-teal-300 transition-colors">
          See all &rarr;
        </Link>
      </div>
      <div className="space-y-2">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/article/${article.id}`}
            className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-900/50 transition-colors group"
          >
            <span className="text-teal-400 mt-1 text-xs">&#9679;</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 font-medium line-clamp-2 group-hover:text-teal-400 transition-colors">
                {article.headline}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{article.source_name} · {timeAgo(article.published_at)}</span>
                <SectorTags article={article} max={1} />
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
