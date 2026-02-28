from pydantic import BaseModel
from datetime import datetime


class ArticleBase(BaseModel):
    source_name: str
    headline: str
    snippet: str | None = None
    original_url: str
    image_url: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    language: str = "en"


class ArticleCreate(ArticleBase):
    finnhub_id: str | None = None
    gnews_url: str | None = None


class ArticleOut(ArticleBase):
    id: int
    ai_summary: str | None = None
    ai_tutorial: str | None = None
    lesson_data: dict | None = None
    processing_status: str
    created_at: datetime
    sectors: list[str] = []


class ArticleDetail(ArticleOut):
    raw_content: str | None = None
    tickers: list["TickerOut"] = []


class TickerOut(BaseModel):
    ticker: str
    price: float | None = None
    price_change_pct: float | None = None


class ArticleListResponse(BaseModel):
    success: bool = True
    data: list[ArticleOut]
    meta: dict


class HeadlinesResponse(BaseModel):
    success: bool = True
    data: dict  # {"hero": ArticleOut, "trending": list[ArticleOut], "world": list, "markets": list}
