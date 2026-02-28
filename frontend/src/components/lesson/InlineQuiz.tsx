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

export default function InlineQuiz({ articleId }: InlineQuizProps) {
  const { user, session, loading: authLoading } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
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
    if (submitted) return;
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
    setSubmitted(true);
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
      } else {
        setError(data.error?.message || "Failed to submit quiz");
      }
    } catch {
      setError("Failed to submit quiz");
    }
  };

  // Results view
  if (result) {
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
