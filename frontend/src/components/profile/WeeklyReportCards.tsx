"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { StaggerList, StaggerItem } from "@/components/shared/MotionWrappers";
import type { WeeklyReport } from "@/types";

export default function WeeklyReportCards({ token }: { token: string }) {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<WeeklyReport[]>("/weekly-reports", { token })
      .then((res) => {
        if (res.success && res.data) setReports(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const formatWeek = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 skeleton-shimmer rounded-xl" />
        ))}
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
    <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {reports.map((r) => (
        <StaggerItem key={r.id}>
          <Link
            href={`/profile/reports/${r.id}`}
            className="block bg-gray-900 border border-gray-800 rounded-xl p-5 transition-all hover:border-teal-400/20 hover:scale-[1.005]"
          >
            <p className="text-sm font-semibold text-white mb-3">
              {formatWeek(r.week_start, r.week_end)}
            </p>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-bold text-teal-400">{r.stats.accuracy_pct}%</span>
              <span className="text-lg font-bold text-yellow-400">+{r.stats.xp_earned} XP</span>
            </div>
            <p className="text-xs text-gray-500">
              {r.stats.articles_in_sectors} articles · {r.stats.quizzes_taken + r.stats.daily_quizzes_taken} quizzes · {r.stats.total_questions} questions
            </p>
          </Link>
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
