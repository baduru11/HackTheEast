"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import TickerBadges from "@/components/article/TickerBadges";
import OriginalArticleLink from "@/components/lesson/OriginalArticleLink";
import LessonHeaderCard from "@/components/lesson/LessonHeaderCard";
import WhatHappenedSection from "@/components/lesson/WhatHappenedSection";
import ConceptCardsSection from "@/components/lesson/ConceptCardsSection";
import MechanismMapSection from "@/components/lesson/MechanismMapSection";
import AssetImpactSection from "@/components/lesson/AssetImpactSection";
import PracticeSkillSection from "@/components/lesson/PracticeSkillSection";
import InlineQuiz from "@/components/lesson/InlineQuiz";
import LessonFallback from "@/components/lesson/LessonFallback";
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

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="max-w-4xl mx-auto px-4 py-8">
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
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400">Article not found</p>
      </div>
    );
  }

  const rawLesson = article.lesson_data;
  const lesson = typeof rawLesson === "string" ? JSON.parse(rawLesson) : rawLesson;

  return (
    <FadeInUp>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4 group">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        {/* Headline */}
        <h1 className="text-2xl font-bold text-white leading-tight mb-3">
          {article.headline}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <span className="text-teal-400 font-medium">{article.source_name}</span>
          {article.author && <><span>·</span><span>{article.author}</span></>}
          <span>·</span>
          <span>{timeAgo(article.published_at)}</span>
        </div>

        {/* Ticker badges */}
        {article.article_tickers && article.article_tickers.length > 0 && (
          <div className="mb-5">
            <TickerBadges tickers={article.article_tickers} />
          </div>
        )}

        {/* Original article link */}
        <div className="mb-8">
          <OriginalArticleLink url={article.original_url} />
        </div>

        {/* Lesson content or fallback */}
        {lesson ? (
          <div className="space-y-10">
            <LessonHeaderCard header={lesson.header} />
            <WhatHappenedSection data={lesson.what_happened} />
            <ConceptCardsSection cards={lesson.concept_cards} />
            <MechanismMapSection data={lesson.mechanism_map} />
            <AssetImpactSection assets={lesson.asset_impact_matrix} />
            <PracticeSkillSection data={lesson.practice_skill} />
            <InlineQuiz articleId={article.id} />
          </div>
        ) : (
          <LessonFallback
            summary={article.ai_summary}
            processing={article.processing_status !== "done"}
          />
        )}
      </div>
    </FadeInUp>
  );
}
