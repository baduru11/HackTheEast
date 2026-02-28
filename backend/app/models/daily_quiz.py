from pydantic import BaseModel


class DailyQuizQuestion(BaseModel):
    question_text: str
    options: list[str]
    correct_index: int
    explanation: str
    source_article_id: int | None = None


class DailyQuizOut(BaseModel):
    id: int
    date: str
    questions: list[dict]  # stripped of correct_index


class DailyQuizSubmit(BaseModel):
    quiz_id: int
    answers: list[int]


class DailyQuizResult(BaseModel):
    score: int
    total_questions: int
    xp_earned: int
    explanations: list[dict]
