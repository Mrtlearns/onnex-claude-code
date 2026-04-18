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
    minio_public_url: str = ""  # Public-facing URL for presigned URLs (e.g. https://s3.example.com)

    # Auth
    jwt_secret: str = ""
    algorithm: str = "HS256"

    # n8n
    n8n_internal_url: str = "http://n8n:5678"

    # App
    app_url: str = "http://localhost:3000"

    # Webhook auth (n8n callbacks)
    webhook_secret: str = ""

    # Authentik (user provisioning for invites)
    authentik_url: str = ""
    authentik_api_token: str = ""

    # n8n workflow IDs (override if workflows are re-imported with new IDs)
    n8n_wf_onboard: str = "0b94eab2-87a1-527d-8dd6-05b48162278d"
    n8n_wf_artifact: str = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"
    n8n_wf_report: str = "7ee20685-8a0a-533d-bff1-20d108c93a63"
    n8n_wf_assign_notify: str = "fmsB0tUoNEwslirl"
    n8n_wf_user_invite: str = "bRsJ4TGcB8aIk4kk"

    # OpenRouter (AI assessments + embeddings)
    openrouter_api_key: str = ""
    embedding_model: str = "openai/text-embedding-3-small"

    # Resend (transactional email)
    resend_api_key: str = ""

    # n8n workflow — assessment completion notification (Workflow 11)
    n8n_wf_assessment_notify: str = ""

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
