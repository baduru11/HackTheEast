from fastapi import APIRouter, Depends

from app.db import supabase as db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/weekly-reports", tags=["weekly-reports"])


@router.get("")
async def list_reports(page: int = 1, limit: int = 10, user_id: str = Depends(get_current_user)):
    reports, total = await db.get_weekly_reports(user_id, page, limit)
    return {
        "success": True,
        "data": reports,
        "meta": {"total": total, "page": page, "limit": limit},
    }


@router.get("/latest")
async def get_latest_report(user_id: str = Depends(get_current_user)):
    report = await db.get_latest_weekly_report(user_id)
    if not report:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "No weekly reports yet"}}
    return {"success": True, "data": report}


@router.get("/{report_id}")
async def get_report(report_id: int, user_id: str = Depends(get_current_user)):
    report = await db.get_weekly_report(report_id, user_id)
    if not report:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Report not found"}}
    return {"success": True, "data": report}


@router.post("/{report_id}/revision")
async def submit_revision(report_id: int, body: dict, user_id: str = Depends(get_current_user)):
    """Submit answers for revision quiz (both retake + fresh questions). Returns graded results."""
    report = await db.get_weekly_report(report_id, user_id)
    if not report:
        return {"success": False, "error": {"code": "NOT_FOUND", "message": "Report not found"}}

    answers = body.get("answers", [])
    quiz_type = body.get("type", "revision")  # "revision" or "fresh"

    if quiz_type == "fresh":
        questions = report.get("fresh_questions", [])
    else:
        questions = report.get("revision_questions", [])

    if len(answers) != len(questions):
        return {"success": False, "error": {"code": "INVALID_ANSWERS", "message": f"Expected {len(questions)} answers"}}

    score = 0
    feedback = []
    for i, q in enumerate(questions):
        is_correct = answers[i] == q["correct_index"]
        if is_correct:
            score += 1
        feedback.append({
            "question_text": q["question_text"],
            "your_answer": answers[i],
            "correct_answer": q["correct_index"],
            "is_correct": is_correct,
            "explanation": q["explanation"],
        })

    return {
        "success": True,
        "data": {
            "score": score,
            "total": len(questions),
            "feedback": feedback,
        },
    }
