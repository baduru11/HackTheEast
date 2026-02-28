"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import type { Quiz, QuizQuestion, QuestionFeedback } from "@/types";

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, session, loading: authLoading } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total_questions: number;
    xp_earned: number;
    gauge_change: number;
    explanations: QuestionFeedback[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/v1/articles/${id}/quiz`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setQuiz(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-900 rounded w-1/3" />
          <div className="h-32 bg-gray-900 rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400 mb-4">You need to sign in to take quizzes</p>
        <Link
          href="/login"
          className="inline-block bg-teal-500 hover:bg-teal-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400">Quiz not available for this article</p>
      </div>
    );
  }

  const questions = quiz.questions;
  const total = questions.length;
  const question = questions[current];

  const handleSelect = (idx: number) => {
    if (submitted) return;
    setSelected(idx);
  };

  const handleNext = () => {
    if (selected === null) return;
    const newAnswers = [...answers, selected];
    setAnswers(newAnswers);
    setSelected(null);

    if (current < total - 1) {
      setCurrent(current + 1);
    } else {
      submitQuiz(newAnswers);
    }
  };

  const submitQuiz = async (finalAnswers: number[]) => {
    setSubmitted(true);
    try {
      const res = await fetch(`/api/v1/articles/${id}/quiz`, {
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

  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="text-5xl font-bold text-white mb-2">
            {result.score}/{result.total_questions}
          </div>
          <p className="text-gray-400">
            +{result.xp_earned} XP · +{result.gauge_change} Gauge
          </p>
        </div>

        <div className="space-y-4">
          {result.explanations.map((fb, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg border ${
                fb.is_correct
                  ? "border-green-800 bg-green-950/30"
                  : "border-red-800 bg-red-950/30"
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                <span className={fb.is_correct ? "text-green-400" : "text-red-400"}>
                  {fb.is_correct ? "✓" : "✗"}
                </span>
                <p className="text-sm text-white font-medium">{fb.question_text}</p>
              </div>
              <p className="text-xs text-gray-400 ml-6">{fb.explanation}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href={`/article/${id}`}
            className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
          >
            &larr; Back to article
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Link
          href={`/article/${id}`}
          className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          &larr; Back to article
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
          <span>Question {current + 1} of {total}</span>
          <span>{Math.round(((current) / total) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full">
          <div
            className="h-full bg-teal-400 rounded-full transition-all"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <h2 className="text-lg font-semibold text-white mb-6">{question.question_text}</h2>

      {/* Options */}
      <div className="space-y-3 mb-8">
        {question.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => handleSelect(idx)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selected === idx
                ? "border-teal-400 bg-teal-400/10 text-white"
                : "border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700"
            }`}
          >
            <span className="text-sm font-medium mr-3 text-gray-500">
              {String.fromCharCode(65 + idx)}.
            </span>
            {option}
          </button>
        ))}
      </div>

      {/* Next/Submit */}
      <button
        onClick={handleNext}
        disabled={selected === null}
        className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {current < total - 1 ? "Next" : "Submit"}
      </button>
    </div>
  );
}
