import os
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional

class Settings(BaseSettings):
    PORT: int = 4000
    NODE_ENV: str = "development"
    API_PREFIX: str = "/api/v1"
    
    JWT_ACCESS_SECRET: str = "supersecret_access_key_must_be_long_and_secure"
    JWT_REFRESH_SECRET: str = "supersecret_refresh_key_must_be_long_and_secure"
    JWT_ACCESS_EXPIRY_MINUTES: int = 10080
    JWT_REFRESH_EXPIRY_DAYS: int = 7
    
    DATABASE_URL: Optional[str] = None
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    
    STRIPE_SECRET_KEY: str = "sk_test_mock"
    STRIPE_WEBHOOK_SECRET: str = "whsec_mock"
    
    AWS_ACCESS_KEY_ID: str = "mock_key"
    AWS_SECRET_ACCESS_KEY: str = "mock_secret"
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "mock_bucket"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Allow extra env vars without throwing errors

settings = Settings()
