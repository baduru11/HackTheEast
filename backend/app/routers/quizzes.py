from fastapi import APIRouter, Depends

from app.db import supabase as db
from app.dependencies import get_current_user
from app.models.quiz import QuizSubmit, QuizCheckBody
from app.services.gauge import calculate_gauge_gain
from app.services.xp import calculate_quiz_xp
from app.services.activity import record_quiz_completed, record_gauge_milestone, record_streak_milestone

router = APIRouter(prefix="/api/v1/articles", tags=["quizzes"])


@router.get("/{article_id}/quiz")
async def get_quiz(article_id: int):
    quiz = await db.get_quiz_by_article(article_id)
    if not quiz:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Quiz not found"}}

    # Strip correct answers for display
    questions = []
    for q in quiz.get("quiz_questions", []):
        questions.append({
            "id": q["id"],
            "question_text": q["question_text"],
            "options": q["options"],
            "order_num": q["order_num"],
        })

    return {
        "success": True,
        "data": {
            "id": quiz["id"],
            "article_id": quiz["article_id"],
            "questions": sorted(questions, key=lambda x: x["order_num"]),
        },
    }


@router.post("/{article_id}/quiz/check")
async def check_answer(article_id: int, body: QuizCheckBody):
    quiz = await db.get_quiz_by_article(article_id)
    if not quiz:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Quiz not found"}}

    questions = sorted(quiz["quiz_questions"], key=lambda x: x["order_num"])
    if body.question_index < 0 or body.question_index >= len(questions):
        return {"success": False, "error": {"code": "INVALID_INDEX", "message": "Invalid question index"}}

    q = questions[body.question_index]
    return {
        "success": True,
        "data": {
            "is_correct": body.answer == q["correct_index"],
            "correct_answer": q["correct_index"],
            "explanation": q["explanation"],
        },
    }


@router.post("/{article_id}/quiz")
async def submit_quiz(
    article_id: int,
    submission: QuizSubmit,
    user_id: str = Depends(get_current_user),
):
    quiz = await db.get_quiz_by_article(article_id)
    if not quiz:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Quiz not found"}}

    # Check if already attempted
    existing = await db.get_quiz_attempt(user_id, quiz["id"])
    if existing:
        return {"success": False, "error": {"code": "QUIZ_ALREADY_COMPLETED", "message": "You have already completed this quiz"}}

    # Grade
    questions = sorted(quiz["quiz_questions"], key=lambda x: x["order_num"])
    if len(submission.answers) != len(questions):
        return {"success": False, "error": {"code": "INVALID_ANSWERS", "message": f"Expected {len(questions)} answers"}}

    score = 0
    feedback = []
    for i, q in enumerate(questions):
        is_correct = submission.answers[i] == q["correct_index"]
        if is_correct:
            score += 1
        feedback.append({
            "question_text": q["question_text"],
            "your_answer": submission.answers[i],
            "correct_answer": q["correct_index"],
            "is_correct": is_correct,
            "explanation": q["explanation"],
        })

    total = len(questions)

    # Calculate rewards
    gauge_gain = await calculate_gauge_gain(score, total)
    xp_earned = await calculate_quiz_xp(user_id, score, total)

    # Save attempt
    await db.insert_quiz_attempt(user_id, quiz["id"], score, total, xp_earned, user_answers=submission.answers)

    # Update XP
    await db.add_xp(user_id, xp_earned)

    # Update gauge for relevant sectors
    article = await db.get_article_by_id(article_id)

    # Record social activity - quiz completed
    headline = (article or {}).get("headline", "an article")
    await record_quiz_completed(user_id, article_id, headline, score, total)

    sector_ids = [s["sector_id"] for s in article.get("article_sectors", [])]
    favorites = await db.get_user_favorites(user_id)
    fav_sector_ids = {f["sector_id"]: f for f in favorites}

    gauge_updates = {}
    for sid in sector_ids:
        if sid in fav_sector_ids:
            current = fav_sector_ids[sid]["gauge_score"]
            new_score = min(current + gauge_gain, 100)
            await db.update_gauge(user_id, sid, new_score)
            gauge_updates[sid] = new_score

    # Check for gauge milestones
    for sid, new_gauge in gauge_updates.items():
        if new_gauge >= 80:
            sector_info = next((f for f in favorites if f["sector_id"] == sid), None)
            sector_name = sector_info.get("sectors", {}).get("name", "Unknown") if sector_info else "Unknown"
            if new_gauge >= 100:
                await record_gauge_milestone(user_id, sector_name, new_gauge, 100)
            elif new_gauge >= 90:
                await record_gauge_milestone(user_id, sector_name, new_gauge, 90)
            else:
                await record_gauge_milestone(user_id, sector_name, new_gauge, 80)

    # Check for streak milestones
    streak = await db.get_streak_days(user_id)
    if streak in (7, 14, 30):
        await record_streak_milestone(user_id, streak)

    return {
        "success": True,
        "data": {
            "score": score,
            "total_questions": total,
            "xp_earned": xp_earned,
            "gauge_change": gauge_gain,
            "gauge_updates": gauge_updates,
            "explanations": feedback,
        },
    }
