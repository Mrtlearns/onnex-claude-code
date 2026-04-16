"""Environment variable configuration for all pipeline services."""
import os


def pg_dsn() -> str:
    return os.environ["PG_DSN"]


def vault_key() -> bytes:
    """Return 32-byte vault key from hex env var."""
    hex_key = os.environ["PIPELINE_VAULT_KEY"]
    key = bytes.fromhex(hex_key)
    if len(key) != 32:
        raise ValueError("PIPELINE_VAULT_KEY must be 32 bytes (64 hex chars)")
    return key


def anthropic_api_key() -> str:
    return os.environ["ANTHROPIC_API_KEY"]


def ollama_url() -> str:
    return os.environ.get("OLLAMA_URL", "http://host.gateway.internal:11434")


def presidio_analyzer_url() -> str:
    return os.environ.get("PRESIDIO_ANALYZER_URL", "http://presidio-analyzer:5001")


def presidio_image_redactor_url() -> str:
    return os.environ.get("PRESIDIO_IMAGE_REDACTOR_URL", "http://presidio-image-redactor:5002")
