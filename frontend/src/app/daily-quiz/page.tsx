"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { FadeInUp } from "@/components/shared/MotionWrappers";
import type { DailyQuiz, DailyQuizResult, DailyQuizExplanation } from "@/types";

/* ── ScoreRing (copied from article quiz page) ── */
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

/* ── Main Page ── */
export default function DailyQuizPage() {
  const { user, session, loading: authLoading } = useAuth();
  const reduced = useReducedMotion();

  /* data state */
  const [quiz, setQuiz] = useState<DailyQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* quiz-play state */
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false); // answer confirmed for current Q
  const [answers, setAnswers] = useState<number[]>([]); // accumulated confirmed answers
  const [direction, setDirection] = useState(1);

  /* result state */
  const [result, setResult] = useState<DailyQuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  /* whether we've transitioned to the final results screen */
  const [showResults, setShowResults] = useState(false);

  /* ── Fetch quiz on mount ── */
  useEffect(() => {
    fetch("/api/v1/daily-quiz/today")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setQuiz(res.data);
        } else {
          setError(res.error?.message || "Failed to load daily quiz");
        }
      })
      .catch(() => setError("Failed to load daily quiz"))
      .finally(() => setLoading(false));
  }, []);

  /* ── Loading skeleton ── */
  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="space-y-4">
          <div className="h-6 skeleton-shimmer rounded w-1/3" />
          <div className="h-4 skeleton-shimmer rounded w-2/3" />
          <div className="h-32 skeleton-shimmer rounded" />
          <div className="h-12 skeleton-shimmer rounded" />
          <div className="h-12 skeleton-shimmer rounded" />
          <div className="h-12 skeleton-shimmer rounded" />
          <div className="h-12 skeleton-shimmer rounded" />
        </div>
      </div>
    );
  }

  /* ── Auth check ── */
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
            <h2 className="text-lg font-semibold text-white mb-2">Sign in to take the Daily Quiz</h2>
            <p className="text-sm text-gray-400 mb-6">Earn XP and track your progress</p>
            <Link
              href="/login"
              className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-medium px-8 py-2.5 rounded-xl transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </FadeInUp>
    );
  }

  /* ── No quiz available ── */
  if (!quiz) {
    return (
      <FadeInUp>
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <div className="glass rounded-2xl p-10">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gray-400/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-400 mb-4">No daily quiz available today</p>
            <Link href="/" className="text-sm text-teal-400 hover:text-teal-300 transition-colors">
              &larr; Back to home
            </Link>
          </div>
        </div>
      </FadeInUp>
    );
  }

  /* ── Error state ── */
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
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to home
            </Link>
          </div>
        </div>
      </FadeInUp>
    );
  }

  const questions = quiz.questions;
  const total = questions.length;

  /* ── Handlers ── */

  const handleSelect = (idx: number) => {
    if (confirmed) return;
    setSelected(idx);
  };

  const handleConfirm = () => {
    if (selected === null || confirmed) return;
    setConfirmed(true);

    // Record this answer
    const newAnswers = [...answers, selected];
    setAnswers(newAnswers);

    // If this is the last question, submit immediately so we can show explanation inline
    if (current >= total - 1) {
      submitQuiz(newAnswers);
    }
  };

  const handleNext = () => {
    if (!confirmed) return;
    setSelected(null);
    setConfirmed(false);
    setDirection(1);
    setCurrent(current + 1);
  };

  const handleSeeResults = () => {
    // result is already available from submit triggered in handleConfirm
    // Transition to the results view
    setConfirmed(false);
    setShowResults(true);
  };

  const submitQuiz = async (finalAnswers: number[]) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/daily-quiz/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
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
            <h2 className="text-xl font-bold text-white mb-2">Already completed today</h2>
            <p className="text-sm text-gray-400 mb-6">
              You&apos;ve already taken today&apos;s quiz. Come back tomorrow for a new challenge!
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-medium px-8 py-2.5 rounded-xl transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to home
            </Link>
          </div>
        </div>
      </FadeInUp>
    );
  }

  /* ── Results view ── */
  if (result && showResults) {
    const pct = result.total_questions > 0 ? result.score / result.total_questions : 0;
    const message = pct >= 0.8 ? "Excellent work!" : pct >= 0.5 ? "Good effort!" : "Keep learning!";

    return (
      <FadeInUp>
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Score card */}
          <div className="glass rounded-2xl p-8 mb-8 glow-teal-sm text-center">
            {reduced ? (
              <ScoreRing score={result.score} total={result.total_questions} />
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                <ScoreRing score={result.score} total={result.total_questions} />
              </motion.div>
            )}

            <p className="text-lg font-semibold text-white mt-4 mb-1">{message}</p>

            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 bg-teal-400/10 px-3 py-1.5 rounded-lg">
                <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-medium text-teal-400">+{result.xp_earned} XP</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-4">Come back tomorrow for a new quiz!</p>
          </div>

          {/* Explanations */}
          <h3 className="text-sm font-medium text-gray-400 mb-3">Review answers</h3>
          <div className="space-y-3">
            {result.explanations.map((fb: DailyQuizExplanation, i: number) => (
              <div
                key={i}
                className={`p-4 rounded-xl border ${
                  fb.is_correct
                    ? "border-green-800/50 bg-green-950/20"
                    : "border-red-800/50 bg-red-950/20"
                }`}
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    fb.is_correct ? "bg-green-500/20" : "bg-red-500/20"
                  }`}>
                    {fb.is_correct ? (
                      <svg className="w-3 h-3 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{fb.question_text}</p>
                    {!fb.is_correct && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Your answer: {String.fromCharCode(65 + fb.your_answer)} &middot; Correct: {String.fromCharCode(65 + fb.correct_answer)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{fb.explanation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Back button */}
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-medium px-8 py-2.5 rounded-xl transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to home
            </Link>
          </div>
        </div>
      </FadeInUp>
    );
  }

  /* ── Submitting state (only show full-page spinner if not on the last question with inline feedback) ── */
  if (submitting && !confirmed) {
    return (
      <FadeInUp>
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <div className="glass rounded-2xl p-10">
            <svg className="w-10 h-10 text-teal-400 mx-auto mb-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-400">Grading your answers...</p>
          </div>
        </div>
      </FadeInUp>
    );
  }

  /* ── Question view ── */
  const question = questions[current];
  const isLastQuestion = current >= total - 1;

  const questionVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  // Get the current explanation from the result if available (for last question inline feedback)
  const currentExplanation = confirmed && result
    ? result.explanations[current]
    : null;

  return (
    <FadeInUp>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-white">Daily Quiz</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(quiz.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Exit
          </Link>
        </div>

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
              <h2 className="text-lg font-semibold text-white mb-6">{question.question_text}</h2>
              <div className="space-y-3 mb-4">
                {question.options.map((option: string, idx: number) => {
                  let optionClasses =
                    "border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700";

                  if (confirmed && currentExplanation) {
                    // After confirming on last question (with server result)
                    if (idx === currentExplanation.correct_answer) {
                      optionClasses = "border-green-500 bg-green-500/10 text-green-400";
                    } else if (idx === selected && !currentExplanation.is_correct) {
                      optionClasses = "border-red-500 bg-red-500/10 text-red-400";
                    } else {
                      optionClasses = "border-gray-800 bg-gray-900 text-gray-500";
                    }
                  } else if (confirmed) {
                    // Confirmed on non-last question (no server data yet)
                    if (idx === selected) {
                      optionClasses = "border-teal-400 bg-teal-400/10 text-white";
                    } else {
                      optionClasses = "border-gray-800 bg-gray-900 text-gray-500";
                    }
                  } else if (selected === idx) {
                    optionClasses = "border-teal-400 bg-teal-400/10 text-white";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(idx)}
                      disabled={confirmed}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${optionClasses} disabled:cursor-default`}
                    >
                      <span className="text-sm font-medium mr-3 text-gray-500">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>

              {/* Inline explanation (reduced motion) */}
              {confirmed && currentExplanation && (
                <div
                  className={`p-4 rounded-xl border mb-6 ${
                    currentExplanation.is_correct
                      ? "border-green-800/50 bg-green-950/20"
                      : "border-red-800/50 bg-red-950/20"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      currentExplanation.is_correct ? "bg-green-500/20" : "bg-red-500/20"
                    }`}>
                      {currentExplanation.is_correct ? (
                        <svg className="w-3 h-3 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {currentExplanation.is_correct ? "Correct!" : "Incorrect"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{currentExplanation.explanation}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <motion.div
              key={current}
              custom={direction}
              variants={questionVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <h2 className="text-lg font-semibold text-white mb-6">{question.question_text}</h2>
              <div className="space-y-3 mb-4">
                {question.options.map((option: string, idx: number) => {
                  let optionClasses =
                    "border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700";

                  if (confirmed && currentExplanation) {
                    if (idx === currentExplanation.correct_answer) {
                      optionClasses = "border-green-500 bg-green-500/10 text-green-400";
                    } else if (idx === selected && !currentExplanation.is_correct) {
                      optionClasses = "border-red-500 bg-red-500/10 text-red-400";
                    } else {
                      optionClasses = "border-gray-800 bg-gray-900 text-gray-500";
                    }
                  } else if (confirmed) {
                    if (idx === selected) {
                      optionClasses = "border-teal-400 bg-teal-400/10 text-white";
                    } else {
                      optionClasses = "border-gray-800 bg-gray-900 text-gray-500";
                    }
                  } else if (selected === idx) {
                    optionClasses = "border-teal-400 bg-teal-400/10 text-white";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(idx)}
                      disabled={confirmed}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${optionClasses} disabled:cursor-default`}
                    >
                      <span className="text-sm font-medium mr-3 text-gray-500">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>

              {/* Inline explanation after confirm (last question only, since we have server data) */}
              {confirmed && currentExplanation && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`p-4 rounded-xl border mb-6 ${
                    currentExplanation.is_correct
                      ? "border-green-800/50 bg-green-950/20"
                      : "border-red-800/50 bg-red-950/20"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      currentExplanation.is_correct ? "bg-green-500/20" : "bg-red-500/20"
                    }`}>
                      {currentExplanation.is_correct ? (
                        <svg className="w-3 h-3 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {currentExplanation.is_correct ? "Correct!" : "Incorrect"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{currentExplanation.explanation}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        {!confirmed ? (
          <button
            onClick={handleConfirm}
            disabled={selected === null}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Confirm Answer
          </button>
        ) : isLastQuestion ? (
          <button
            onClick={handleSeeResults}
            disabled={submitting}
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
