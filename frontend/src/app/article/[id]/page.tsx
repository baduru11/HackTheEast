"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import TickerBadges from "@/components/article/TickerBadges";
import TabSwitcher from "@/components/article/TabSwitcher";
import { FadeInUp } from "@/components/shared/MotionWrappers";
import type { Article } from "@/types";

function timeAgo(date: string | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const TABS = ["Summary", "Financial Learning", "Quiz"];

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Summary");

  useEffect(() => {
    fetch(`/api/v1/articles/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setArticle(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-4">
          <div className="h-8 skeleton-shimmer rounded w-3/4" />
          <div className="h-4 skeleton-shimmer rounded w-1/2" />
          <div className="h-64 skeleton-shimmer rounded" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400">Article not found</p>
      </div>
    );
  }

  return (
    <FadeInUp>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4 group">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <h1 className="text-2xl font-bold text-white leading-tight mb-3">
          {article.headline}
        </h1>

        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <span className="text-teal-400 font-medium">{article.source_name}</span>
          {article.author && <><span>·</span><span>{article.author}</span></>}
          <span>·</span>
          <span>{timeAgo(article.published_at)}</span>
        </div>

        {article.article_tickers && (
          <div className="mb-6">
            <TickerBadges tickers={article.article_tickers} />
          </div>
        )}

        <TabSwitcher tabs={TABS} active={tab} onChange={setTab} />

        <div className="py-6">
          {tab === "Summary" && (
            <div className="prose prose-invert prose-sm max-w-none">
              {article.ai_summary ? (
                article.ai_summary.split("\n").map((p, i) => (
                  <p key={i} className="text-gray-300 leading-relaxed mb-4">{p}</p>
                ))
              ) : (
                <p className="text-gray-500">Summary not yet generated.</p>
              )}
            </div>
          )}

          {tab === "Financial Learning" && (
            <div className="prose prose-invert prose-sm max-w-none">
              {article.ai_tutorial ? (
                article.ai_tutorial.split("\n").map((p, i) => (
                  <p key={i} className="text-gray-300 leading-relaxed mb-4">{p}</p>
                ))
              ) : (
                <p className="text-gray-500">Tutorial not yet generated.</p>
              )}
            </div>
          )}

          {tab === "Quiz" && (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Test your knowledge with a quiz about this article</p>
              <Link
                href={`/article/${id}/quiz`}
                className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                Take Quiz &rarr;
              </Link>
            </div>
          )}
        </div>

        <div className="border-t border-gray-800 pt-4">
          <a
            href={article.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
          >
            Read original article &rarr;
          </a>
        </div>
      </div>
    </FadeInUp>
  );
}
