"use client";

import { useEffect, useState } from "react";
import HeroCard from "@/components/home/HeroCard";
import TrendingGrid from "@/components/home/TrendingGrid";
import SectorPreview from "@/components/home/SectorPreview";
import type { Article } from "@/types";

interface HeadlinesData {
  hero: Article | null;
  trending: Article[];
  world: Article[];
  markets: Article[];
}

export default function HomePage() {
  const [data, setData] = useState<HeadlinesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/articles/headlines")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-80 bg-gray-900 rounded-xl" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-900 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">No articles yet</h2>
        <p className="text-gray-400">News will appear once the ingestion pipeline runs.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      {data.hero && <HeroCard article={data.hero} />}

      {data.trending.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-4">Trending</h2>
          <TrendingGrid articles={data.trending} />
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <SectorPreview title="World" href="/world" articles={data.world} />
        <SectorPreview title="Markets" href="/markets" articles={data.markets} />
      </div>
    </div>
  );
}
