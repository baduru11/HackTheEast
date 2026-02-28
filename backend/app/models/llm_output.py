from pydantic import BaseModel, field_validator
import re


class LLMQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: str

    @field_validator("options")
    @classmethod
    def validate_options(cls, v):
        if len(v) != 4:
            raise ValueError("Must have exactly 4 options")
        return v

    @field_validator("correct_index")
    @classmethod
    def validate_correct_index(cls, v):
        if v < 0 or v > 3:
            raise ValueError("correct_index must be 0-3")
        return v


class LLMArticleOutput(BaseModel):
    summary: str
    tutorial: str
    questions: list[LLMQuestion]
    sectors: list[str]

    @field_validator("questions")
    @classmethod
    def validate_questions(cls, v):
        if len(v) < 3 or len(v) > 5:
            raise ValueError("Must have 3-5 questions")
        return v

    @classmethod
    def from_raw_response(cls, raw: str) -> "LLMArticleOutput":
        cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
        return cls.model_validate_json(cleaned)
