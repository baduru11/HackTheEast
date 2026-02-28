from pydantic import BaseModel, field_validator


class StockOut(BaseModel):
    ticker: str
    name: str
    price: float
    change_24h: float


class PredictionCreate(BaseModel):
    ticker: str
    direction: str
    price_at_bet: float

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v: str) -> str:
        if v not in ("up", "down"):
            raise ValueError("direction must be 'up' or 'down'")
        return v


class PredictionOut(BaseModel):
    id: int
    ticker: str
    stock_name: str
    direction: str
    price_at_bet: float
    price_at_close: float | None
    result: str
    xp_earned: int
    created_at: str


class TodayStocksOut(BaseModel):
    date: str
    stocks: list[StockOut]
