from pydantic import BaseModel
from datetime import datetime


class QuestionOut(BaseModel):
    id: int
    question_text: str
    options: list[str]
    order_num: int


class QuestionWithAnswer(QuestionOut):
    correct_index: int
    explanation: str


class QuizOut(BaseModel):
    id: int
    article_id: int
    questions: list[QuestionOut]


class QuizSubmit(BaseModel):
    answers: list[int]


class QuizCheckBody(BaseModel):
    question_index: int
    answer: int


class QuizResult(BaseModel):
    success: bool = True
    data: "QuizResultData"


class QuizResultData(BaseModel):
    score: int
    total_questions: int
    xp_earned: int
    gauge_change: int
    new_gauge_score: int
    explanations: list["QuestionFeedback"]


class QuestionFeedback(BaseModel):
    question_text: str
    your_answer: int
    correct_answer: int
    is_correct: bool
    explanation: str
