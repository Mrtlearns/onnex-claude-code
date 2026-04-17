"""Application configuration — all values pulled from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # PostgreSQL
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_user: str = "cmmc"
    postgres_password: str = ""
    postgres_db: str = "cmmc"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_secure: bool = False

    # Auth
    jwt_secret: str = ""
    algorithm: str = "HS256"

    # n8n
    n8n_internal_url: str = "http://n8n:5678"

    # App
    app_url: str = "http://localhost:3000"

    # Webhook auth (n8n callbacks)
    webhook_secret: str = "changeme"

    # Authentik (user provisioning for invites)
    authentik_url: str = ""
    authentik_api_token: str = ""

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def minio_endpoint_clean(self) -> str:
        """Strip http:// or https:// prefix — MinIO SDK expects host:port only."""
        ep = self.minio_endpoint
        for prefix in ("https://", "http://"):
            if ep.startswith(prefix):
                return ep[len(prefix):]
        return ep


settings = Settings()
