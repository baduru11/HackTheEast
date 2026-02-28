"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { FadeInUp, StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";
import type { WeeklyReport } from "@/types";

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { session, loading: authLoading } = useAuth();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary" | "revision" | "fresh">("summary");

  // Revision quiz state
  const [revisionAnswers, setRevisionAnswers] = useState<Record<number, number>>({});
  const [revisionSubmitted, setRevisionSubmitted] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState<{ score: number; total: number; feedback: { is_correct: boolean; correct_answer: number; explanation: string }[] } | null>(null);

  // Fresh quiz state
  const [freshAnswers, setFreshAnswers] = useState<Record<number, number>>({});
  const [freshSubmitted, setFreshSubmitted] = useState(false);
  const [freshFeedback, setFreshFeedback] = useState<{ score: number; total: number; feedback: { is_correct: boolean; correct_answer: number; explanation: string }[] } | null>(null);

  useEffect(() => {
    if (authLoading || !session) return;
    apiFetch<WeeklyReport>(`/weekly-reports/${id}`, { token: session.access_token })
      .then((res) => {
        if (res.success && res.data) setReport(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, session, authLoading]);

  const formatWeek = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
  };

  const submitRevision = async () => {
    if (!report || !session) return;
    const answers = report.revision_questions.map((_, i) => revisionAnswers[i] ?? -1);
    const res = await apiFetch<{ score: number; total: number; feedback: { is_correct: boolean; correct_answer: number; explanation: string }[] }>(`/weekly-reports/${report.id}/revision`, {
      token: session.access_token,
      method: "POST",
      body: JSON.stringify({ answers, type: "revision" }),
    });
    if (res.success && res.data) {
      setRevisionFeedback(res.data);
      setRevisionSubmitted(true);
    }
  };

  const submitFresh = async () => {
    if (!report || !session) return;
    const answers = report.fresh_questions.map((_, i) => freshAnswers[i] ?? -1);
    const res = await apiFetch<{ score: number; total: number; feedback: { is_correct: boolean; correct_answer: number; explanation: string }[] }>(`/weekly-reports/${report.id}/revision`, {
      token: session.access_token,
      method: "POST",
      body: JSON.stringify({ answers, type: "fresh" }),
    });
    if (res.success && res.data) {
      setFreshFeedback(res.data);
      setFreshSubmitted(true);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-4">
          <div className="h-8 skeleton-shimmer rounded w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 skeleton-shimmer rounded-lg" />
            ))}
          </div>
          <div className="h-64 skeleton-shimmer rounded-xl" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400 mb-4">Sign in to view this report</p>
        <Link
          href="/login"
          className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400">Report not found</p>
        <Link href="/profile#weekly-reports" className="text-teal-400 hover:text-teal-300 text-sm mt-2 inline-block">
          Back to Profile
        </Link>
      </div>
    );
  }

  return (
    <FadeInUp>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/profile#weekly-reports"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4 group"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Profile
        </Link>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-6">
          Weekly Report: {formatWeek(report.week_start, report.week_end)}
        </h1>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Accuracy", value: `${report.stats.accuracy_pct}%`, color: "text-teal-400" },
            { label: "XP Earned", value: `+${report.stats.xp_earned}`, color: "text-yellow-400" },
            { label: "Quizzes", value: `${report.stats.quizzes_taken + report.stats.daily_quizzes_taken}`, color: "text-blue-400" },
            { label: "Articles", value: `${report.stats.articles_in_sectors}`, color: "text-purple-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-6">
          {(
            [
              { key: "summary" as const, label: "Sector Summaries" },
              { key: "revision" as const, label: `Retake (${report.revision_questions.length})` },
              { key: "fresh" as const, label: `Challenge (${report.fresh_questions.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? "border-teal-400 text-teal-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "summary" && (
          <StaggerList className="space-y-4">
            {report.sector_summaries.map((s) => (
              <StaggerItem key={s.sector_id}>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">{s.sector_name}</h3>
                    <span className="text-xs text-gray-500">{s.article_count} articles</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{s.summary}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        )}

        {tab === "revision" && (
          <div className="space-y-4">
            {report.revision_questions.length === 0 ? (
              <div className="text-center py-8 bg-gray-900 border border-gray-800 rounded-xl">
                <p className="text-gray-400">Perfect week! No wrong answers to review.</p>
              </div>
            ) : (
              <>
                {report.revision_questions.map((q, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <p className="text-xs text-gray-500 mb-2">{q.article_title}</p>
                    <p className="text-sm text-white font-medium mb-3">{q.question_text}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {q.options.map((opt, oi) => {
                        const isSelected = revisionAnswers[i] === oi;
                        const showResult = revisionSubmitted && revisionFeedback;
                        const isCorrect = showResult && oi === revisionFeedback.feedback[i]?.correct_answer;
                        const isWrong = showResult && isSelected && !revisionFeedback.feedback[i]?.is_correct;

                        return (
                          <button
                            key={oi}
                            onClick={() => !revisionSubmitted && setRevisionAnswers({ ...revisionAnswers, [i]: oi })}
                            disabled={revisionSubmitted}
                            className={`text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                              isCorrect
                                ? "border-green-500/50 bg-green-500/10 text-green-400"
                                : isWrong
                                ? "border-red-500/50 bg-red-500/10 text-red-400"
                                : isSelected
                                ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                                : "border-gray-700 text-gray-400 hover:border-gray-600"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {revisionSubmitted && revisionFeedback && (
                      <p className="text-xs text-gray-400 mt-3 bg-gray-800/50 rounded-lg p-2">
                        {revisionFeedback.feedback[i]?.explanation}
                      </p>
                    )}
                  </div>
                ))}
                {!revisionSubmitted && (
                  <button
                    onClick={submitRevision}
                    disabled={Object.keys(revisionAnswers).length !== report.revision_questions.length}
                    className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
                  >
                    Submit Answers
                  </button>
                )}
                {revisionSubmitted && revisionFeedback && (
                  <div className="text-center py-3 bg-gray-900 border border-gray-800 rounded-xl">
                    <p className="text-lg font-bold text-white">
                      {revisionFeedback.score}/{revisionFeedback.total} correct
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "fresh" && (
          <div className="space-y-4">
            {report.fresh_questions.length === 0 ? (
              <div className="text-center py-8 bg-gray-900 border border-gray-800 rounded-xl">
                <p className="text-gray-400">No challenge questions this week.</p>
              </div>
            ) : (
              <>
                {report.fresh_questions.map((q, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <p className="text-sm text-white font-medium mb-3">{q.question_text}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {q.options.map((opt, oi) => {
                        const isSelected = freshAnswers[i] === oi;
                        const showResult = freshSubmitted && freshFeedback;
                        const isCorrect = showResult && oi === freshFeedback.feedback[i]?.correct_answer;
                        const isWrong = showResult && isSelected && !freshFeedback.feedback[i]?.is_correct;

                        return (
                          <button
                            key={oi}
                            onClick={() => !freshSubmitted && setFreshAnswers({ ...freshAnswers, [i]: oi })}
                            disabled={freshSubmitted}
                            className={`text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                              isCorrect
                                ? "border-green-500/50 bg-green-500/10 text-green-400"
                                : isWrong
                                ? "border-red-500/50 bg-red-500/10 text-red-400"
                                : isSelected
                                ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                                : "border-gray-700 text-gray-400 hover:border-gray-600"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {freshSubmitted && freshFeedback && (
                      <p className="text-xs text-gray-400 mt-3 bg-gray-800/50 rounded-lg p-2">
                        {freshFeedback.feedback[i]?.explanation}
                      </p>
                    )}
                  </div>
                ))}
                {!freshSubmitted && (
                  <button
                    onClick={submitFresh}
                    disabled={Object.keys(freshAnswers).length !== report.fresh_questions.length}
                    className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
                  >
                    Submit Answers
                  </button>
                )}
                {freshSubmitted && freshFeedback && (
                  <div className="text-center py-3 bg-gray-900 border border-gray-800 rounded-xl">
                    <p className="text-lg font-bold text-white">
                      {freshFeedback.score}/{freshFeedback.total} correct
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </FadeInUp>
  );
}
