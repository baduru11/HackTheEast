import json

import httpx

from app.config import settings
from app.models.llm_output import LLMArticleOutput, LessonData

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """You are a financial news analyst and educator. Given a news article, you must produce:

1. **summary**: A concise 3-4 paragraph summary of the article's key points.
2. **tutorial**: A short financial literacy lesson (2-3 paragraphs) explaining the financial concepts mentioned in the article in simple terms. Teach the reader something they can apply.
3. **questions**: 3-5 multiple choice questions testing comprehension of the article and the financial concepts. Each question must have exactly 4 options, a correct_index (0-3), and an explanation of why the answer is correct.
4. **sectors**: A list of 1-2 sector slugs this article PRIMARILY belongs to. Be strict — only tag sectors that are the main focus. Choose from:
   - World regions (use ONLY if the article is specifically about that region's economy/politics):
     asia, americas, europe, india, china, japan
   - war: armed conflicts, sanctions, military operations affecting markets
   - crypto: Bitcoin, Ethereum, altcoins, DeFi, blockchain, crypto exchanges
   - stocks: individual company stocks, earnings reports, IPOs, equity markets
   - options: options trading, derivatives, calls/puts, options strategies
   - bonds: treasury bonds, yields, fixed income, interest rates, debt markets
   - currency: forex, exchange rates, dollar strength, currency pairs
   - etfs: ETF funds, index funds, Vanguard/BlackRock fund news
   - indices: major stock indices ONLY (S&P 500, Dow Jones, Nasdaq Composite, FTSE 100, Nikkei 225, DAX). Do NOT use for general market news.
   - sector: sector rotation, industry-specific trends (energy, tech, healthcare sectors)
   Do NOT tag more than 2 sectors. Pick only the most relevant ones.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "...",
  "tutorial": "...",
  "questions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "..."
    }
  ],
  "sectors": ["stocks", "americas"]
}"""


async def generate_article_content(headline: str, body: str) -> LLMArticleOutput | None:
    """Generate summary, tutorial, and quiz from article content."""
    user_prompt = f"""Article headline: {headline}

Article body:
{body[:8000]}"""  # Truncate to stay within context limits

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "minimax/minimax-m2.5",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()
            data = response.json()

        raw_content = data["choices"][0]["message"]["content"]
        return LLMArticleOutput.from_raw_response(raw_content)
    except Exception as e:
        print(f"LLM error: {e}")
        return None


LESSON_SYSTEM_PROMPT = """You are a financial news analyst and educator. Given a news article, produce a structured financial lesson (FLS v1) as a single JSON object with these exact keys and rules:

{
  "header": {
    "lesson_title": "{Event} → {Asset/Theme}",
    "difficulty": "Beginner" | "Intermediate" | "Advanced",
    "read_time_core_min": 3-5,
    "read_time_deep_min": 8-12,
    "tags": ["tag1", "tag2", ...],
    "learning_outcomes": ["outcome1", "outcome2", "outcome3"],
    "disclaimer": "Education only — not investment advice"
  },
  "what_happened": {
    "event_bullets": ["fact1", "fact2"],
    "market_question": "So what does this mean for markets?",
    "timing_note": "e.g. Weekend announcement, markets reopen Monday"
  },
  "concept_cards": [
    {
      "concept": "Name",
      "plain_meaning": "1-line plain English",
      "why_it_moves_prices": "1-line",
      "in_this_article": "1-line connection",
      "common_confusion": "1-line misconception"
    }
  ],
  "mechanism_map": {
    "transmission_table": [
      {
        "shock": "Initial event",
        "channel": "How it transmits",
        "market_variable": "What changes",
        "asset_impact": "Effect on assets",
        "confidence": "Low" | "Medium" | "High"
      }
    ],
    "edge_list": [
      {
        "from_node": "Source",
        "to_node": "Target",
        "relationship": "causal" | "correlational" | "assumption",
        "evidence": "From article or inference",
        "strength": 1-5
      }
    ]
  },
  "asset_impact_matrix": [
    {
      "asset": "BTC" | "Equities" | "USD" | "Gold" | "Oil" | "UST",
      "typical_reaction": "1-line description",
      "direction": "up" | "down" | "neutral" | "mixed",
      "mechanism_driver": "Risk premium / Liquidity / Rates / USD / Narrative",
      "confidence": "Low" | "Medium" | "High"
    }
  ],
  "practice_skill": {
    "skill_target": "What skill to practice",
    "inputs": "Data from article",
    "level_zone": "Key level or zone",
    "scenario_a": "If X happens, then...",
    "scenario_b": "If Y happens, then...",
    "what_to_watch": "Non-advice observation"
  },
  "quiz": [
    {
      "type": "recall" | "mechanism" | "application",
      "prompt": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0-3,
      "explanation": "Why this is correct"
    }
  ],
  "sectors": ["sector_slug1"],
  "summary": "3-4 paragraph summary of the article"
}

RULES:
- concept_cards: exactly 3-5 cards
- quiz: exactly 6 questions — 2 recall, 2 mechanism, 2 application
- asset_impact_matrix: exactly 6 assets (BTC, Equities, USD, Gold, Oil, UST)
- sectors: max 2. Choose from: asia, americas, europe, india, china, japan, war, crypto, stocks, options, bonds, currency, etfs, indices, sector
- No prediction language — use "If... then risk increases" not "will happen"
- Every edge must be tagged as causal/correlational/assumption
- All text must be factual and based on the article content

Respond ONLY with valid JSON."""


async def generate_lesson(headline: str, body: str) -> LessonData | None:
    """Generate a full FLS v1 structured lesson from article content."""
    user_prompt = f"""Article headline: {headline}

Article body:
{body[:8000]}"""

    try:
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "minimax/minimax-m2.5",
                    "messages": [
                        {"role": "system", "content": LESSON_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()
            data = response.json()

        raw_content = data["choices"][0]["message"]["content"]
        return LessonData.from_raw_response(raw_content)
    except Exception as e:
        print(f"Lesson LLM error: {e}")
        return None


async def generate_daily_quiz_questions(article_texts: list[str]) -> list[dict]:
    combined = "\n\n---\n\n".join(article_texts)

    prompt = f"""Based on the following financial news articles, generate exactly 5 multiple-choice quiz questions.

Articles:
{combined}

Return a JSON array of 5 objects, each with:
- "question_text": the question string
- "options": array of exactly 4 answer strings
- "correct_index": integer 0-3 indicating correct answer
- "explanation": brief explanation of why the answer is correct

Focus on testing understanding of:
- Key facts from the articles
- Financial concepts mentioned
- Market implications
- Cause and effect relationships

Return ONLY the JSON array, no other text."""

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "minimax/minimax-m2.5",
        "messages": [
            {"role": "system", "content": "You are a financial education quiz generator. Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(OPENROUTER_URL, headers=headers, json=payload)
        resp.raise_for_status()

    content = resp.json()["choices"][0]["message"]["content"]
    parsed = json.loads(content)

    # Handle both {"questions": [...]} and direct array
    if isinstance(parsed, dict) and "questions" in parsed:
        questions = parsed["questions"]
    elif isinstance(parsed, list):
        questions = parsed
    else:
        raise ValueError("Unexpected LLM response format")

    return questions[:5]
