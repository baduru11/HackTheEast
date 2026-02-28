"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { FadeInUp } from "@/components/shared/MotionWrappers";
import type { Quiz, QuestionFeedback } from "@/types";
import FinaMascot from "@/components/quiz/FinaMascot";
import GaugeMeter from "@/components/profile/GaugeMeter";

function ScoreRing({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? score / total : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const color = pct >= 0.8 ? "#22c55e" : pct >= 0.5 ? "#eab308" : "#ef4444";

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#1f2937" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-xs text-gray-400">of {total}</span>
      </div>
    </div>
  );
}

type Feedback = { is_correct: boolean; correct_answer: number; explanation: string };

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, session, loading: authLoading } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState(1);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total_questions: number;
    xp_earned: number;
    gauge_change: number;
    new_gauge_score: number;
    explanations: QuestionFeedback[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reduced = useReducedMotion();

  useEffect(() => {
    fetch(`/api/v1/articles/${id}/quiz`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setQuiz(res.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="space-y-4">
          <div className="h-6 skeleton-shimmer rounded w-1/3" />
          <div className="h-32 skeleton-shimmer rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <FadeInUp>
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <div className="glass rounded-2xl p-10 glow-teal-sm">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-teal-400/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Sign in to take quizzes</h2>
            <p className="text-sm text-gray-400 mb-6">Earn XP and track your progress</p>
            <Link href="/login" className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-medium px-8 py-2.5 rounded-xl transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </FadeInUp>
    );
  }

  if (!quiz) {
    return (
      <FadeInUp>
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <div className="glass rounded-2xl p-10">
            <p className="text-gray-400 mb-4">Quiz not available for this article</p>
            <Link href={`/article/${id}`} className="text-sm text-teal-400 hover:text-teal-300 transition-colors">
              &larr; Back to lesson
            </Link>
          </div>
        </div>
      </FadeInUp>
    );
  }

  const questions = quiz.questions;
  const total = questions.length;
  const isLastQuestion = current >= total - 1;

  /* ── Handlers ── */

  const handleSelect = (idx: number) => {
    if (confirmed) return;
    setSelected(idx);
  };

  const handleConfirm = async () => {
    if (selected === null || confirmed) return;
    const newAnswers = [...answers, selected];
    setAnswers(newAnswers);
    setConfirmed(true);

    // Fetch feedback for this question
    const res = await fetch(`/api/v1/articles/${id}/quiz/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_index: current, answer: selected }),
    });
    const data = await res.json();
    if (data.success) setFeedback(data.data);

    // Submit in background when last question confirmed
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
      const res = await fetch(`/api/v1/articles/${id}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else if (data.error?.code === "QUIZ_ALREADY_COMPLETED") {
        setAlreadyCompleted(true);
      } else {
        setError(data.error?.message || "Failed to submit quiz");
      }
    } catch {
      setError("Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Already completed ── */
  if (alreadyCompleted) {
    return (
      <FadeInUp>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="glass rounded-2xl p-10 glow-teal-sm">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-teal-400/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Already completed</h2>
            <p className="text-sm text-gray-400 mb-6">You&apos;ve already taken this quiz. Your score and XP have been recorded.</p>
            <Link href={`/article/${id}`} className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-medium px-8 py-2.5 rounded-xl transition-colors text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to lesson
            </Link>
          </div>
        </div>
      </FadeInUp>
    );
  }

  /* ── Summary ── */
  if (showSummary && result) {
    const pct = result.total_questions > 0 ? result.score / result.total_questions : 0;
    const message = pct >= 0.8 ? "Excellent work!" : pct >= 0.5 ? "Good effort!" : "Keep learning!";

    return (
      <FadeInUp>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="glass rounded-2xl p-8 mb-8 glow-teal-sm text-center">
            {reduced ? (
              <ScoreRing score={result.score} total={result.total_questions} />
            ) : (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
                <ScoreRing score={result.score} total={result.total_questions} />
              </motion.div>
            )}
            <p className="text-lg font-semibold text-white mt-4 mb-1">{message}</p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-1.5 bg-teal-400/10 px-3 py-1.5 rounded-lg">
                <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-medium text-teal-400">+{result.xp_earned} XP</span>
              </div>
              {result.gauge_change > 0 && (
                <div className="flex items-center gap-2 bg-green-400/10 px-3 py-2 rounded-lg">
                  <GaugeMeter
                    score={result.new_gauge_score}
                    from={result.new_gauge_score - result.gauge_change}
                    delay={800}
                    size={52}
                  />
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-green-400">+{result.gauge_change}</span>
                    <span className="text-[10px] text-gray-500">Gauge</span>
                  </div>
                </div>
              )}
              {result.gauge_change === 0 && (
                <div className="flex items-center gap-1.5 bg-gray-400/10 px-3 py-1.5 rounded-lg">
                  <span className="text-sm font-medium text-gray-400">No gauge change</span>
                </div>
              )}
            </div>
          </div>

          <h3 className="text-sm font-medium text-gray-400 mb-3">Review answers</h3>
          <div className="space-y-3">
            {result.explanations.map((fb, i) => (
              <div key={i} className={`p-4 rounded-xl border ${fb.is_correct ? "border-green-800/50 bg-green-950/20" : "border-red-800/50 bg-red-950/20"}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${fb.is_correct ? "bg-green-500/20" : "bg-red-500/20"}`}>
                    {fb.is_correct ? (
                      <svg className="w-3 h-3 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="w-3 h-3 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{fb.question_text}</p>
                    <p className="text-xs text-gray-400 mt-1">{fb.explanation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href={`/article/${id}`} className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-medium px-8 py-2.5 rounded-xl transition-colors text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to lesson
            </Link>
          </div>
        </div>
      </FadeInUp>
    );
  }

  if (error) {
    return (
      <FadeInUp>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="glass rounded-2xl p-10">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-400/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-400 mb-6">{error}</p>
            <Link href={`/article/${id}`} className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to lesson
            </Link>
          </div>
        </div>
      </FadeInUp>
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

  const renderOptions = (animate: boolean) => (
    <div className="space-y-3 mb-4">
      {question.options.map((option, idx) => (
        <button
          key={idx}
          onClick={() => handleSelect(idx)}
          disabled={confirmed}
          className={`w-full text-left p-4 rounded-lg border transition-all disabled:cursor-default ${getOptionClass(idx)}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-gray-500 flex-shrink-0">{String.fromCharCode(65 + idx)}.</span>
              <span className="text-sm">{option}</span>
            </div>
            {feedback && idx === feedback.correct_answer && (
              <span className="text-[11px] font-semibold text-green-400 flex-shrink-0">Correct</span>
            )}
            {feedback && idx === selected && !feedback.is_correct && (
              <span className="text-[11px] font-semibold text-red-400 flex-shrink-0">Your answer</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );

  const renderFeedback = () => {
    if (!feedback) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={`p-4 rounded-xl border mb-6 ${feedback.is_correct ? "border-green-800/50 bg-green-950/20" : "border-red-800/50 bg-red-950/20"}`}
      >
        <div className="flex items-start gap-2.5">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${feedback.is_correct ? "bg-green-500/20" : "bg-red-500/20"}`}>
            {feedback.is_correct ? (
              <svg className="w-3 h-3 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            ) : (
              <svg className="w-3 h-3 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {feedback.is_correct ? "Correct!" : `Incorrect — correct answer: ${String.fromCharCode(65 + feedback.correct_answer)}`}
            </p>
            <p className="text-xs text-gray-400 mt-1">{feedback.explanation}</p>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <FadeInUp>
      <FinaMascot expression={finaExpression} />
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
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
                <span className="inline-block text-[10px] font-medium text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded mb-3">{questionType}</span>
              )}
              <h2 className="text-lg font-semibold text-white mb-6">{question.question_text}</h2>
              {renderOptions(false)}
              {renderFeedback()}
            </div>
          ) : (
            <motion.div key={current} custom={direction} variants={questionVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }}>
              {questionType && (
                <span className="inline-block text-[10px] font-medium text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded mb-3">{questionType}</span>
              )}
              <h2 className="text-lg font-semibold text-white mb-6">{question.question_text}</h2>
              {renderOptions(true)}
              {renderFeedback()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action button */}
        {!confirmed ? (
          <button
            onClick={handleConfirm}
            disabled={selected === null}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Confirm Answer
          </button>
        ) : !feedback ? (
          <button disabled className="w-full bg-teal-500/50 text-white font-medium py-3 rounded-lg cursor-not-allowed">
            Checking...
          </button>
        ) : isLastQuestion ? (
          <button
            onClick={() => setShowSummary(true)}
            disabled={submitting || !result}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? "Grading..." : "See Results"}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Next Question
          </button>
        )}
      </div>
    </FadeInUp>
  );
}
