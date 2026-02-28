import httpx

from app.config import settings
from app.models.llm_output import LLMArticleOutput

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """You are a financial news analyst and educator. Given a news article, you must produce:

1. **summary**: A concise 3-4 paragraph summary of the article's key points.
2. **tutorial**: A short financial literacy lesson (2-3 paragraphs) explaining the financial concepts mentioned in the article in simple terms. Teach the reader something they can apply.
3. **questions**: 3-5 multiple choice questions testing comprehension of the article and the financial concepts. Each question must have exactly 4 options, a correct_index (0-3), and an explanation of why the answer is correct.
4. **sectors**: A list of sector slugs this article belongs to. Choose from: asia, americas, europe, india, china, japan, war, crypto, stocks, options, bonds, currency, etfs, indices, sector.

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
