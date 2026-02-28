from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str = ""
    finnhub_api_key: str
    gnews_api_key: str
    openrouter_api_key: str

    class Config:
        env_file = ".env"


settings = Settings()
