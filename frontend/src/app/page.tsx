"use client";

import { useEffect, useState } from "react";
import HeroCard from "@/components/home/HeroCard";
import TrendingGrid from "@/components/home/TrendingGrid";
import SectorPreview from "@/components/home/SectorPreview";
import { FadeInUp } from "@/components/shared/MotionWrappers";
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
        <div className="space-y-8">
          <div className="h-80 skeleton-shimmer rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 skeleton-shimmer rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <h2 className="text-2xl font-bold text-white mb-2">No articles yet</h2>
        <p className="text-gray-400">News will appear once the ingestion pipeline runs.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      {data.hero && <HeroCard article={data.hero} />}

      {data.trending.length > 0 && (
        <FadeInUp delay={0.1}>
          <section>
            <h2 className="text-lg font-bold text-white mb-4">Trending</h2>
            <TrendingGrid articles={data.trending} />
          </section>
        </FadeInUp>
      )}

      <FadeInUp delay={0.2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <SectorPreview title="World" href="/world" articles={data.world} />
          <SectorPreview title="Markets" href="/markets" articles={data.markets} />
        </div>
      </FadeInUp>
    </div>
  );
}
