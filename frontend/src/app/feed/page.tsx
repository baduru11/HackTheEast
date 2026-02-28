"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import ArticleCard from "@/components/feed/ArticleCard";
import type { Article } from "@/types";

export default function FeedPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchFeed = async (p: number) => {
    if (!session) return;
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    const res = await fetch(`/api/v1/articles/feed?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
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
    if (!session) return;
    setPage(1);
    setLoading(true);
    fetchFeed(1);
  }, [session]);

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-900 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Your Feed</h2>
        <p className="text-gray-400 mb-4">Sign in to see news from your favorite sectors</p>
        <Link
          href="/login"
          className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-white mb-6">My Feed</h1>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-900 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">My Feed</h2>
        <p className="text-gray-400 mb-4">
          No articles yet. Pick some sectors to start your personalized feed.
        </p>
        <Link
          href="/profile/onboarding"
          className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Pick sectors
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">My Feed</h1>
      <div className="space-y-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
        {articles.length < total && (
          <button
            onClick={() => {
              const next = page + 1;
              setPage(next);
              fetchFeed(next);
            }}
            className="w-full py-3 text-sm text-teal-400 hover:text-teal-300 border border-gray-800 rounded-lg hover:bg-gray-900/50 transition-colors"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
