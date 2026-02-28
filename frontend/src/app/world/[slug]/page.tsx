"use client";

import { use } from "react";
import Link from "next/link";
import ArticleList from "@/components/feed/ArticleList";

const SECTOR_NAMES: Record<string, string> = {
  asia: "Asia",
  americas: "Americas",
  europe: "Europe",
  india: "India",
  china: "China",
  japan: "Japan",
  war: "War",
};

export default function WorldSectorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const name = SECTOR_NAMES[slug] || slug;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/world" className="text-gray-400 hover:text-white transition-colors">
          &larr;
        </Link>
        <h1 className="text-2xl font-bold text-white">{name}</h1>
      </div>
      <ArticleList sector={slug} />
    </div>
  );
}
