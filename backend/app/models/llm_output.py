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


# --- FLS v1 Lesson Models ---


class LessonHeader(BaseModel):
    lesson_title: str
    difficulty: str
    read_time_core_min: int
    read_time_deep_min: int
    tags: list[str]
    learning_outcomes: list[str]
    disclaimer: str = "Education only — not investment advice"


class WhatHappened(BaseModel):
    event_bullets: list[str]
    market_question: str
    timing_note: str


class ConceptCard(BaseModel):
    concept: str
    plain_meaning: str
    why_it_moves_prices: str
    in_this_article: str
    common_confusion: str


class TransmissionRow(BaseModel):
    shock: str
    channel: str
    market_variable: str
    asset_impact: str
    confidence: str


class Edge(BaseModel):
    from_node: str
    to_node: str
    relationship: str
    evidence: str
    strength: int

    @field_validator("strength")
    @classmethod
    def validate_strength(cls, v):
        if v < 1 or v > 5:
            raise ValueError("strength must be 1-5")
        return v


class MechanismMap(BaseModel):
    transmission_table: list[TransmissionRow]
    edge_list: list[Edge]


class AssetImpact(BaseModel):
    asset: str
    typical_reaction: str
    direction: str
    mechanism_driver: str
    confidence: str


class PracticeSkill(BaseModel):
    skill_target: str
    inputs: str
    level_zone: str
    scenario_a: str
    scenario_b: str
    what_to_watch: str


class LessonQuizQuestion(BaseModel):
    type: str
    prompt: str
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


class LessonData(BaseModel):
    header: LessonHeader
    what_happened: WhatHappened
    concept_cards: list[ConceptCard]
    mechanism_map: MechanismMap
    asset_impact_matrix: list[AssetImpact]
    practice_skill: PracticeSkill
    quiz: list[LessonQuizQuestion]
    sectors: list[str]
    summary: str

    @field_validator("concept_cards")
    @classmethod
    def validate_concept_cards(cls, v):
        if len(v) < 3 or len(v) > 5:
            raise ValueError("Must have 3-5 concept cards")
        return v

    @field_validator("quiz")
    @classmethod
    def validate_quiz(cls, v):
        if len(v) != 6:
            raise ValueError("Must have exactly 6 quiz questions")
        return v

    @classmethod
    def from_raw_response(cls, raw: str) -> "LessonData":
        cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
        return cls.model_validate_json(cleaned)
