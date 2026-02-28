"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import type { Quiz, QuestionFeedback } from "@/types";
import SectionHeading from "./SectionHeading";
import FinaMascot from "@/components/quiz/FinaMascot";

interface InlineQuizProps {
  articleId: number;
}

type Feedback = { is_correct: boolean; correct_answer: number; explanation: string };

export default function InlineQuiz({ articleId }: InlineQuizProps) {
  const { user, session, loading: authLoading } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [direction, setDirection] = useState(1);
  const [result, setResult] = useState<{
    score: number;
    total_questions: number;
    xp_earned: number;
    gauge_change: number;
    explanations: QuestionFeedback[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const reduced = useReducedMotion();

  useEffect(() => {
    fetch(`/api/v1/articles/${articleId}/quiz`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setQuiz(res.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [articleId]);

  if (authLoading || loading) {
    return (
      <section>
        <SectionHeading number="06" title="Quiz" />
        <div className="space-y-3">
          <div className="h-6 skeleton-shimmer rounded w-1/3" />
          <div className="h-32 skeleton-shimmer rounded" />
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section>
        <SectionHeading number="06" title="Quiz" />
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-gray-400 mb-4">Sign in to test your knowledge and earn XP</p>
          <Link href="/login" className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  if (!quiz) {
    return (
      <section>
        <SectionHeading number="06" title="Quiz" />
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-gray-500 text-sm">Quiz not available yet</p>
        </div>
      </section>
    );
  }

  const questions = quiz.questions;
  const total = questions.length;
  const isLastQuestion = current >= total - 1;

  const handleSelect = (idx: number) => {
    if (confirmed) return;
    setSelected(idx);
  };

  const handleConfirm = async () => {
    if (selected === null || confirmed) return;
    const newAnswers = [...answers, selected];
    setAnswers(newAnswers);
    setConfirmed(true);

    const res = await fetch(`/api/v1/articles/${articleId}/quiz/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_index: current, answer: selected }),
    });
    const data = await res.json();
    if (data.success) setFeedback(data.data);

    if (current >= total - 1) {
      submitQuiz(newAnswers);
    }
  };

  const handleNext = () => {
    setSelected(null);
    setConfirmed(false);
    setFeedback(null);
    setDirection(1);
    setCurrent(current + 1);
  };

  const submitQuiz = async (finalAnswers: number[]) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/articles/${articleId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const data = await res.json();
      if (data.success) setResult(data.data);
      else setError(data.error?.message || "Failed to submit quiz");
    } catch {
      setError("Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Summary ── */
  if (showSummary && result) {
    return (
      <section>
        <SectionHeading number="06" title="Quiz Results" />
        <div className="glass rounded-xl p-6">
          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-white mb-1">
              {result.score}/{result.total_questions}
            </div>
            <p className="text-sm text-gray-400">
              +{result.xp_earned} XP · +{result.gauge_change} Gauge
            </p>
          </div>
          <div className="space-y-3">
            {result.explanations.map((fb, i) => (
              <div key={i} className={`p-3 rounded-lg border ${fb.is_correct ? "border-green-800 bg-green-950/30" : "border-red-800 bg-red-950/30"}`}>
                <div className="flex items-start gap-2 mb-1">
                  <span className={`flex-shrink-0 ${fb.is_correct ? "text-green-400" : "text-red-400"}`}>
                    {fb.is_correct ? "✓" : "✗"}
                  </span>
                  <p className="text-sm text-white font-medium">{fb.question_text}</p>
                </div>
                <p className="text-xs text-gray-400 ml-6">{fb.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <SectionHeading number="06" title="Quiz" />
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </section>
    );
  }

  /* ── Quiz view ── */
  const question = questions[current];
  const questionType = (question as { question_type?: string | null }).question_type;
  const finaExpression = feedback ? (feedback.is_correct ? "happy" : "angry") : "default";

  const questionVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  const getOptionClass = (idx: number) => {
    if (feedback) {
      if (idx === feedback.correct_answer) return "border-green-500 bg-green-500/10 text-green-300";
      if (idx === selected && !feedback.is_correct) return "border-red-500 bg-red-500/10 text-red-300";
      return "border-gray-800 bg-gray-900/60 text-gray-500";
    }
    if (selected === idx) return "border-teal-400 bg-teal-400/10 text-white";
    return "border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700";
  };

  return (
    <section>
      <FinaMascot expression={finaExpression} />
      <SectionHeading number="06" title="Quiz" />
      <div className="glass rounded-xl p-6">
        {/* Progress */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
            <span>Question {current + 1} of {total}</span>
            <span>{Math.round(((current + (confirmed ? 1 : 0)) / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((current + (confirmed ? 1 : 0)) / total) * 100}%`,
                background: "linear-gradient(90deg, #14b8a6, #2dd4bf)",
                boxShadow: "0 0 8px rgba(45, 212, 191, 0.4)",
              }}
            />
          </div>
        </div>

        {/* Question */}
        <AnimatePresence mode="wait" custom={direction}>
          {reduced ? (
            <div key={current}>
              {questionType && (
                <span className="text-[10px] font-medium text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded inline-block mb-3">{questionType}</span>
              )}
              <h3 className="text-sm font-semibold text-white mb-4">{question.question_text}</h3>
              <div className="space-y-2 mb-4">
                {question.options.map((option, idx) => (
                  <button key={idx} onClick={() => handleSelect(idx)} disabled={confirmed}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-sm disabled:cursor-default ${getOptionClass(idx)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-500">{String.fromCharCode(65 + idx)}.</span>
                        {option}
                      </div>
                      {feedback && idx === feedback.correct_answer && <span className="text-[11px] font-semibold text-green-400 flex-shrink-0">Correct</span>}
                      {feedback && idx === selected && !feedback.is_correct && <span className="text-[11px] font-semibold text-red-400 flex-shrink-0">Yours</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <motion.div key={current} custom={direction} variants={questionVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }}>
              {questionType && (
                <span className="text-[10px] font-medium text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded inline-block mb-3">{questionType}</span>
              )}
              <h3 className="text-sm font-semibold text-white mb-4">{question.question_text}</h3>
              <div className="space-y-2 mb-4">
                {question.options.map((option, idx) => (
                  <button key={idx} onClick={() => handleSelect(idx)} disabled={confirmed}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-sm disabled:cursor-default ${getOptionClass(idx)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-500">{String.fromCharCode(65 + idx)}.</span>
                        {option}
                      </div>
                      {feedback && idx === feedback.correct_answer && <span className="text-[11px] font-semibold text-green-400 flex-shrink-0">Correct</span>}
                      {feedback && idx === selected && !feedback.is_correct && <span className="text-[11px] font-semibold text-red-400 flex-shrink-0">Yours</span>}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline feedback */}
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`p-3 rounded-xl border mb-4 ${feedback.is_correct ? "border-green-800/50 bg-green-950/20" : "border-red-800/50 bg-red-950/20"}`}
          >
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 flex-shrink-0 ${feedback.is_correct ? "text-green-400" : "text-red-400"}`}>
                {feedback.is_correct ? "✓" : "✗"}
              </span>
              <div>
                <p className="text-sm font-medium text-white">
                  {feedback.is_correct ? "Correct!" : `Incorrect — correct answer: ${String.fromCharCode(65 + feedback.correct_answer)}`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{feedback.explanation}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Action button */}
        {!confirmed ? (
          <button onClick={handleConfirm} disabled={selected === null}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm">
            Confirm Answer
          </button>
        ) : !feedback ? (
          <button disabled className="w-full bg-teal-500/50 text-white font-medium py-2.5 rounded-lg cursor-not-allowed text-sm">
            Checking...
          </button>
        ) : isLastQuestion ? (
          <button onClick={() => setShowSummary(true)} disabled={submitting || !result}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm">
            {submitting ? "Grading..." : "See Results"}
          </button>
        ) : (
          <button onClick={handleNext}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
            Next Question
          </button>
        )}
      </div>
    </section>
  );
}
