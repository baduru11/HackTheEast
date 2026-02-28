"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import type { Quiz, QuestionFeedback } from "@/types";
import SectionHeading from "./SectionHeading";

interface InlineQuizProps {
  articleId: number;
}

function ExplanationCard({ fb }: { fb: QuestionFeedback }) {
  return (
    <div className={`p-3 rounded-xl border mb-4 ${
      fb.is_correct ? "border-green-800/50 bg-green-950/20" : "border-red-800/50 bg-red-950/20"
    }`}>
      <div className="flex items-start gap-2.5">
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
          <p className="text-sm font-medium text-white">
            {fb.is_correct ? "Correct!" : `Incorrect — correct answer: ${String.fromCharCode(65 + fb.correct_answer)}`}
          </p>
          <p className="text-xs text-gray-400 mt-1">{fb.explanation}</p>
        </div>
      </div>
    </div>
  );
}

export default function InlineQuiz({ articleId }: InlineQuizProps) {
  const { user, session, loading: authLoading } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<"quiz" | "review" | "summary">("quiz");
  const [reviewIdx, setReviewIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [result, setResult] = useState<{
    score: number;
    total_questions: number;
    xp_earned: number;
    gauge_change: number;
    explanations: QuestionFeedback[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reduced = useReducedMotion();

  useEffect(() => {
    fetch(`/api/v1/articles/${articleId}/quiz`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setQuiz(res.data);
      })
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
          <Link
            href="/login"
            className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
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

  const handleSelect = (idx: number) => {
    if (phase !== "quiz") return;
    setSelected(idx);
  };

  const handleNext = () => {
    if (selected === null) return;
    const newAnswers = [...answers, selected];
    setAnswers(newAnswers);
    setSelected(null);
    setDirection(1);

    if (current < total - 1) {
      setCurrent(current + 1);
    } else {
      submitQuiz(newAnswers);
    }
  };

  const submitQuiz = async (finalAnswers: number[]) => {
    try {
      const res = await fetch(`/api/v1/articles/${articleId}/quiz`, {
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
        setReviewIdx(0);
        setPhase("review");
      } else {
        setError(data.error?.message || "Failed to submit quiz");
      }
    } catch {
      setError("Failed to submit quiz");
    }
  };

  /* ── Review phase ── */
  if (phase === "review" && result) {
    const fb = result.explanations[reviewIdx];
    const q = questions[reviewIdx];
    const questionType = (q as { question_type?: string | null }).question_type;
    const isLastReview = reviewIdx >= total - 1;

    return (
      <section>
        <SectionHeading number="06" title="Quiz" />
        <div className="glass rounded-xl p-6">
          {/* Review header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-widest">
              Review {reviewIdx + 1}/{total}
            </span>
            <span className="text-xs text-gray-500">{result.score}/{result.total_questions} correct</span>
          </div>

          {/* Progress */}
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((reviewIdx + 1) / total) * 100}%`,
                background: "linear-gradient(90deg, #14b8a6, #2dd4bf)",
              }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={reviewIdx}
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -60, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {questionType && (
                <span className="text-[10px] font-medium text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded inline-block mb-3">
                  {questionType}
                </span>
              )}
              <h3 className="text-sm font-semibold text-white mb-4">{q.question_text}</h3>

              <div className="space-y-2 mb-4">
                {q.options.map((option, idx) => {
                  let cls = "border-gray-800 bg-gray-900/60 text-gray-500";
                  if (idx === fb.correct_answer) cls = "border-green-500 bg-green-500/10 text-green-300";
                  else if (idx === fb.your_answer && !fb.is_correct) cls = "border-red-500 bg-red-500/10 text-red-300";

                  return (
                    <div key={idx} className={`w-full p-3 rounded-lg border flex items-center justify-between gap-2 text-sm ${cls}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-gray-500 flex-shrink-0">{String.fromCharCode(65 + idx)}.</span>
                        <span>{option}</span>
                      </div>
                      {idx === fb.correct_answer && (
                        <span className="text-[11px] font-semibold text-green-400 flex-shrink-0">Correct</span>
                      )}
                      {idx === fb.your_answer && !fb.is_correct && (
                        <span className="text-[11px] font-semibold text-red-400 flex-shrink-0">Yours</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <ExplanationCard fb={fb} />
            </motion.div>
          </AnimatePresence>

          {isLastReview ? (
            <button
              onClick={() => setPhase("summary")}
              className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              See Results
            </button>
          ) : (
            <button
              onClick={() => setReviewIdx(reviewIdx + 1)}
              className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              Next Question
            </button>
          )}
        </div>
      </section>
    );
  }

  /* ── Summary / Results view ── */
  if (phase === "summary" && result) {
    return (
      <section>
        <SectionHeading number="06" title="Quiz Results" />
        <div className="glass rounded-xl p-6">
          <div className="text-center mb-6">
            {reduced ? (
              <div className="text-4xl font-bold text-white mb-1">
                {result.score}/{result.total_questions}
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <div className="text-4xl font-bold text-white mb-1">
                  {result.score}/{result.total_questions}
                </div>
              </motion.div>
            )}
            <p className="text-sm text-gray-400">
              +{result.xp_earned} XP · +{result.gauge_change} Gauge
            </p>
          </div>

          <div className="space-y-3">
            {result.explanations.map((fb, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${
                  fb.is_correct
                    ? "border-green-800 bg-green-950/30"
                    : "border-red-800 bg-red-950/30"
                }`}
              >
                <div className="flex items-start gap-2 mb-1">
                  <span className={`flex-shrink-0 ${fb.is_correct ? "text-green-400" : "text-red-400"}`}>
                    {fb.is_correct ? "\u2713" : "\u2717"}
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

  /* ── Quiz phase ── */
  const question = questions[current];
  const questionType = (question as { question_type?: string | null }).question_type;

  const questionVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <section>
      <SectionHeading number="06" title="Quiz" />
      <div className="glass rounded-xl p-6">
        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
            <span>Question {current + 1} of {total}</span>
            <span>{Math.round((current / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(current / total) * 100}%`,
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
              <div className="flex items-center gap-2 mb-3">
                {questionType && (
                  <span className="text-[10px] font-medium text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded">
                    {questionType}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white mb-4">{question.question_text}</h3>
              <div className="space-y-2 mb-6">
                {question.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                      selected === idx
                        ? "border-teal-400 bg-teal-400/10 text-white"
                        : "border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700"
                    }`}
                  >
                    <span className="font-medium mr-2 text-gray-500">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    {option}
                  </button>
                ))}
              </div>
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
              <div className="flex items-center gap-2 mb-3">
                {questionType && (
                  <span className="text-[10px] font-medium text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded">
                    {questionType}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white mb-4">{question.question_text}</h3>
              <div className="space-y-2 mb-6">
                {question.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                      selected === idx
                        ? "border-teal-400 bg-teal-400/10 text-white"
                        : "border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700"
                    }`}
                  >
                    <span className="font-medium mr-2 text-gray-500">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    {option}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleNext}
          disabled={selected === null}
          className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
        >
          {current < total - 1 ? "Next" : "Submit"}
        </button>
      </div>
    </section>
  );
}
