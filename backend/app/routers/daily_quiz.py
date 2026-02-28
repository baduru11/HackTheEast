from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.db import supabase as db
from app.models.daily_quiz import DailyQuizSubmit
from app.services.daily_quiz import get_or_create_daily_quiz


class DailyQuizCheckBody(BaseModel):
    question_index: int
    answer: int

router = APIRouter(prefix="/api/v1/daily-quiz", tags=["daily-quiz"])


@router.get("/today")
async def get_today_quiz():
    try:
        quiz = await get_or_create_daily_quiz()
    except ValueError as e:
        return {"success": False, "error": {"code": "NO_QUIZ", "message": str(e)}}

    # Strip correct answers for client
    safe_questions = []
    for q in quiz["questions"]:
        safe_questions.append({
            "question_text": q["question_text"],
            "options": q["options"],
        })

    return {
        "success": True,
        "data": {
            "id": quiz["id"],
            "date": quiz["date"],
            "questions": safe_questions,
        },
    }


@router.post("/check")
async def check_daily_answer(body: DailyQuizCheckBody):
    from datetime import date
    today = date.today().isoformat()
    quiz = await db.get_daily_quiz_by_date(today)
    if not quiz:
        return {"success": False, "error": {"code": "NO_QUIZ", "message": "No quiz available"}}

    questions = quiz["questions"]
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


@router.post("/submit")
async def submit_daily_quiz(
    body: DailyQuizSubmit,
    user_id: str = Depends(get_current_user),
):
    from datetime import date

    today = date.today().isoformat()
    quiz = await db.get_daily_quiz_by_date(today)
    if not quiz:
        return {"success": False, "error": {"code": "NO_QUIZ", "message": "No quiz available today"}}

    # Check if already attempted
    existing = await db.get_daily_quiz_attempt(user_id, quiz["id"])
    if existing:
        return {"success": False, "error": {"code": "QUIZ_ALREADY_COMPLETED", "message": "You already completed today's quiz"}}

    questions = quiz["questions"]
    if len(body.answers) != len(questions):
        return {"success": False, "error": {"code": "INVALID_ANSWERS", "message": f"Expected {len(questions)} answers"}}

    # Grade
    score = 0
    explanations = []
    for i, q in enumerate(questions):
        is_correct = body.answers[i] == q["correct_index"]
        if is_correct:
            score += 1
        explanations.append({
            "question_text": q["question_text"],
            "your_answer": body.answers[i],
            "correct_answer": q["correct_index"],
            "is_correct": is_correct,
            "explanation": q["explanation"],
        })

    # XP: 10 per correct answer
    xp_earned = score * 10

    # Save attempt
    await db.insert_daily_quiz_attempt(user_id, quiz["id"], body.answers, score, len(questions), xp_earned)

    # Award XP
    if xp_earned > 0:
        await db.add_xp(user_id, xp_earned)

    # Log activity
    await db.insert_activity(user_id, "daily_quiz_completed", {
        "score": score,
        "total": len(questions),
        "xp_earned": xp_earned,
    })

    return {
        "success": True,
        "data": {
            "score": score,
            "total_questions": len(questions),
            "xp_earned": xp_earned,
            "explanations": explanations,
        },
    }
