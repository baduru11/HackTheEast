import type { Article } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  world: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  markets: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const FALLBACK = "bg-gray-500/15 text-gray-400 border-gray-500/20";

export default function SectorTags({
  article,
  max = 2,
}: {
  article: Article;
  max?: number;
}) {
  const sectors = article.article_sectors;
  if (!sectors?.length) return null;

  const shown = sectors.slice(0, max);

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {shown.map((s) => (
        <span
          key={s.sector_id}
          className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
            CATEGORY_COLORS[s.sectors.category] || FALLBACK
          }`}
        >
          {s.sectors.name}
        </span>
      ))}
    </span>
  );
}
