"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { FadeInUp, StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";

interface SectorSummary {
  sector_id: number;
  sector_name: string;
  summary: string;
  article_count: number;
}

interface RevisionQuestion {
  source: string;
  article_title: string;
  question_text: string;
  options: string[];
  correct_index: number;
  user_answer: number;
  explanation: string;
}

interface FreshQuestion {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  based_on_topic: string;
}

interface ReportStats {
  articles_in_sectors: number;
  quizzes_taken: number;
  daily_quizzes_taken: number;
  total_questions: number;
  correct_answers: number;
  accuracy_pct: number;
  xp_earned: number;
}

interface WeeklyReport {
  id: number;
  week_start: string;
  week_end: string;
  sector_summaries: SectorSummary[];
  revision_questions: RevisionQuestion[];
  fresh_questions: FreshQuestion[];
  stats: ReportStats;
  created_at: string;
}

export default function WeeklyReports({ token }: { token: string }) {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [selected, setSelected] = useState<WeeklyReport | null>(null);
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
    apiFetch<WeeklyReport[]>("/weekly-reports", { token })
      .then((res) => {
        if (res.success && res.data) {
          setReports(res.data);
          if (res.data.length > 0) setSelected(res.data[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const formatWeek = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${s.toLocaleDateString("en-US", opts)} - ${e.toLocaleDateString("en-US", opts)}`;
  };

  const submitRevision = async () => {
    if (!selected) return;
    const answers = selected.revision_questions.map((_, i) => revisionAnswers[i] ?? -1);
    const res = await apiFetch<{ score: number; total: number; feedback: any[] }>(`/weekly-reports/${selected.id}/revision`, {
      token,
      method: "POST",
      body: JSON.stringify({ answers, type: "revision" }),
    });
    if (res.success && res.data) {
      setRevisionFeedback(res.data);
      setRevisionSubmitted(true);
    }
  };

  const submitFresh = async () => {
    if (!selected) return;
    const answers = selected.fresh_questions.map((_, i) => freshAnswers[i] ?? -1);
    const res = await apiFetch<{ score: number; total: number; feedback: any[] }>(`/weekly-reports/${selected.id}/revision`, {
      token,
      method: "POST",
      body: JSON.stringify({ answers, type: "fresh" }),
    });
    if (res.success && res.data) {
      setFreshFeedback(res.data);
      setFreshSubmitted(true);
    }
  };

  // Reset quiz state when switching reports
  useEffect(() => {
    setRevisionAnswers({});
    setRevisionSubmitted(false);
    setRevisionFeedback(null);
    setFreshAnswers({});
    setFreshSubmitted(false);
    setFreshFeedback(null);
    setTab("summary");
  }, [selected?.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 skeleton-shimmer rounded-lg w-48" />
        <div className="h-64 skeleton-shimmer rounded-xl" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-900 border border-gray-800 rounded-xl">
        <p className="text-gray-400">No weekly reports yet.</p>
        <p className="text-gray-500 text-sm mt-1">Your first report will be generated next Monday.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Report selector */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r)}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selected?.id === r.id
                ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                : "bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-700"
            }`}
          >
            {formatWeek(r.week_start, r.week_end)}
          </button>
        ))}
      </div>

      {selected && (
        <FadeInUp key={selected.id}>
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Accuracy", value: `${selected.stats.accuracy_pct}%`, color: "text-teal-400" },
              { label: "XP Earned", value: `+${selected.stats.xp_earned}`, color: "text-yellow-400" },
              { label: "Quizzes", value: `${selected.stats.quizzes_taken + selected.stats.daily_quizzes_taken}`, color: "text-blue-400" },
              { label: "Articles", value: `${selected.stats.articles_in_sectors}`, color: "text-purple-400" },
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
                { key: "revision" as const, label: `Retake (${selected.revision_questions.length})` },
                { key: "fresh" as const, label: `Challenge (${selected.fresh_questions.length})` },
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
              {selected.sector_summaries.map((s) => (
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
              {selected.revision_questions.length === 0 ? (
                <div className="text-center py-8 bg-gray-900 border border-gray-800 rounded-xl">
                  <p className="text-gray-400">Perfect week! No wrong answers to review.</p>
                </div>
              ) : (
                <>
                  {selected.revision_questions.map((q, i) => (
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
                      disabled={Object.keys(revisionAnswers).length !== selected.revision_questions.length}
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
              {selected.fresh_questions.length === 0 ? (
                <div className="text-center py-8 bg-gray-900 border border-gray-800 rounded-xl">
                  <p className="text-gray-400">No challenge questions this week.</p>
                </div>
              ) : (
                <>
                  {selected.fresh_questions.map((q, i) => (
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
                      disabled={Object.keys(freshAnswers).length !== selected.fresh_questions.length}
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
        </FadeInUp>
      )}
    </div>
  );
}
