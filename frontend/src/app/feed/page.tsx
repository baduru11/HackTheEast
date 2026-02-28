"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import ArticleCard from "@/components/feed/ArticleCard";
import { StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";
import type { Article } from "@/types";

export default function FeedPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchFeed = async (p: number) => {
    if (!session) return;
    const res = await apiFetch<Article[]>(`/articles/feed?page=${p}&limit=20`, {
      token: session.access_token,
    });
    if (res.success && res.data) {
      if (p === 1) {
        setArticles(res.data);
      } else {
        setArticles((prev) => [...prev, ...res.data!]);
      }
      setTotal((res.meta?.total as number) ?? 0);
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
            <div key={i} className="h-24 skeleton-shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
        </svg>
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
            <div key={i} className="h-24 skeleton-shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
        </svg>
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
      <StaggerList className="space-y-3">
        {articles.map((article) => (
          <StaggerItem key={article.id}>
            <ArticleCard article={article} />
          </StaggerItem>
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
      </StaggerList>
    </div>
  );
}
