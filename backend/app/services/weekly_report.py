from datetime import datetime, timedelta

from app.db import supabase as db
from app.services.email import send_weekly_report_email
from app.services.llm import generate_sector_weekly_summary, generate_revision_questions


async def generate_weekly_report(user_id: str, week_start: datetime, week_end: datetime) -> dict | None:
    """Generate a complete weekly report for a single user."""
    start_str = week_start.isoformat()
    end_str = week_end.isoformat()

    # 1. Get user's favorite sectors
    favorites = await db.get_user_favorites(user_id)
    if not favorites:
        return None

    sector_ids = [f["sector_id"] for f in favorites]
    sector_map = {f["sector_id"]: f["sectors"]["name"] for f in favorites}

    # 2. Get articles for these sectors in the date range
    articles = await db.get_articles_for_sectors_in_range(sector_ids, start_str, end_str)

    # Group articles by sector
    articles_by_sector: dict[int, list[dict]] = {sid: [] for sid in sector_ids}
    for article in articles:
        for sec in article.get("article_sectors", []):
            sid = sec["sector_id"]
            if sid in articles_by_sector:
                articles_by_sector[sid].append(article)

    # 3. Generate LLM summaries per sector
    sector_summaries = []
    for sid in sector_ids:
        sector_articles = articles_by_sector.get(sid, [])
        summary_text = await generate_sector_weekly_summary(
            sector_map[sid], sector_articles
        )
        sector_summaries.append({
            "sector_id": sid,
            "sector_name": sector_map[sid],
            "summary": summary_text or "No significant activity this week.",
            "article_count": len(sector_articles),
            "top_article_ids": [a["id"] for a in sector_articles[:5]],
        })

    # 4. Collect wrong answers from article quizzes
    revision_questions = []
    wrong_topics = []

    article_attempts = await db.get_user_quiz_attempts_for_week(user_id, start_str, end_str)
    for attempt in article_attempts:
        user_answers = attempt.get("user_answers")
        if not user_answers:
            continue
        quiz_data = attempt.get("quizzes", {})
        questions = quiz_data.get("quiz_questions", [])
        article_id = quiz_data.get("article_id")
        # Get article headline
        article = await db.get_article_by_id(article_id) if article_id else None
        article_title = (article or {}).get("headline", "Unknown article")
        for i, q in enumerate(questions):
            if i < len(user_answers) and user_answers[i] != q["correct_index"]:
                revision_questions.append({
                    "source": "article_quiz",
                    "source_id": attempt.get("quiz_id"),
                    "article_title": article_title,
                    "question_text": q["question_text"],
                    "options": q["options"],
                    "correct_index": q["correct_index"],
                    "user_answer": user_answers[i],
                    "explanation": q["explanation"],
                })
                wrong_topics.append(q["question_text"])

    # 5. Collect wrong answers from daily quizzes
    daily_attempts = await db.get_user_daily_quiz_attempts_for_week(user_id, start_str, end_str)
    for attempt in daily_attempts:
        user_answers = attempt.get("answers", [])
        daily_quiz = attempt.get("daily_quizzes", {})
        questions = daily_quiz.get("questions", [])
        for i, q in enumerate(questions):
            if i < len(user_answers) and user_answers[i] != q["correct_index"]:
                revision_questions.append({
                    "source": "daily_quiz",
                    "source_id": attempt.get("quiz_id"),
                    "article_title": "Daily Quiz",
                    "question_text": q["question_text"],
                    "options": q["options"],
                    "correct_index": q["correct_index"],
                    "user_answer": user_answers[i],
                    "explanation": q["explanation"],
                })
                wrong_topics.append(q["question_text"])

    # 6. Generate fresh revision questions via LLM
    sector_names = [sector_map[sid] for sid in sector_ids]
    fresh_questions = await generate_revision_questions(wrong_topics, sector_names)

    # 7. Compute stats
    total_article_quizzes = len(article_attempts)
    total_daily_quizzes = len(daily_attempts)
    total_questions = sum(a.get("total_questions", 0) for a in article_attempts) + sum(a.get("total_questions", 0) for a in daily_attempts)
    correct_answers = sum(a.get("score", 0) for a in article_attempts) + sum(a.get("score", 0) for a in daily_attempts)
    xp_earned = sum(a.get("xp_earned", 0) for a in article_attempts) + sum(a.get("xp_earned", 0) for a in daily_attempts)

    # Gauge changes
    gauge_changes = []
    for fav in favorites:
        gauge_changes.append({
            "sector_name": fav["sectors"]["name"],
            "current": fav["gauge_score"],
        })

    stats = {
        "articles_in_sectors": len(articles),
        "quizzes_taken": total_article_quizzes,
        "daily_quizzes_taken": total_daily_quizzes,
        "total_questions": total_questions,
        "correct_answers": correct_answers,
        "accuracy_pct": round(correct_answers * 100 / total_questions) if total_questions > 0 else 0,
        "xp_earned": xp_earned,
        "gauge_snapshot": gauge_changes,
    }

    # 8. Store the report
    report = await db.insert_weekly_report({
        "user_id": user_id,
        "week_start": week_start.date().isoformat(),
        "week_end": week_end.date().isoformat(),
        "sector_summaries": sector_summaries,
        "revision_questions": revision_questions,
        "fresh_questions": fresh_questions,
        "stats": stats,
    })

    return report


async def generate_all_weekly_reports():
    """Generate weekly reports for all users with favorites. Called by scheduler."""
    # Calculate last week's Mon-Sun
    today = datetime.utcnow()
    # Find the most recent Monday (could be today if Monday)
    days_since_monday = today.weekday()  # Monday = 0
    this_monday = today.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_since_monday)
    last_monday = this_monday - timedelta(days=7)
    last_sunday = this_monday - timedelta(seconds=1)  # End of Sunday 23:59:59

    user_ids = await db.get_users_with_favorites()
    print(f"[weekly_report] generating reports for {len(user_ids)} users, week {last_monday.date()} to {last_sunday.date()}")

    for user_id in user_ids:
        try:
            report = await generate_weekly_report(user_id, last_monday, last_sunday)
            if report:
                print(f"[weekly_report] generated report #{report['id']} for user {user_id}")
                # Send notification
                await db.insert_notification(
                    user_id=user_id,
                    type="weekly_report",
                    title="Your Weekly Report is Ready",
                    body="Check out your personalized sector summary and revision quiz.",
                    link="/profile#weekly-reports",
                )
                # Send email
                profile = await db.get_profile(user_id)
                if profile:
                    from app.dependencies import supabase as sb_client
                    try:
                        auth_user = sb_client.auth.admin.get_user_by_id(user_id)
                        if auth_user and auth_user.user and auth_user.user.email:
                            await send_weekly_report_email(
                                to_email=auth_user.user.email,
                                display_name=profile.get("display_name") or profile.get("username") or "there",
                                report=report,
                            )
                            await db.update_weekly_report(report["id"], {"email_sent": True})
                    except Exception as email_err:
                        print(f"[weekly_report] email error for {user_id}: {email_err}")
        except Exception as e:
            print(f"[weekly_report] error for user {user_id}: {e}")

    print(f"[weekly_report] done")
