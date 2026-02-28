"use client";

import { useEffect, useState } from "react";
import ArticleCard from "./ArticleCard";
import type { Article } from "@/types";

interface ArticleListProps {
  sector?: string;
  category?: string;
}

export default function ArticleList({ sector, category }: ArticleListProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchArticles = async (p: number) => {
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (sector) params.set("sector", sector);
    if (category) params.set("category", category);

    const res = await fetch(`/api/v1/articles?${params}`);
    const data = await res.json();
    if (data.success) {
      if (p === 1) {
        setArticles(data.data);
      } else {
        setArticles((prev) => [...prev, ...data.data]);
      }
      setTotal(data.meta?.total ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
    setLoading(true);
    fetchArticles(1);
  }, [sector, category]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchArticles(next);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-900 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!articles.length) {
    return (
      <p className="text-center text-gray-500 py-12">No articles found</p>
    );
  }

  return (
    <div className="space-y-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
      {articles.length < total && (
        <button
          onClick={loadMore}
          className="w-full py-3 text-sm text-teal-400 hover:text-teal-300 border border-gray-800 rounded-lg hover:bg-gray-900/50 transition-colors"
        >
          Load more
        </button>
      )}
    </div>
  );
}
