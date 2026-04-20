"""MinIO object storage helpers."""
import hashlib
import hmac as _hmac
import io
import time
from datetime import timedelta
from urllib.parse import urlencode

from minio import Minio
from minio.error import S3Error  # noqa: F401 — re-exported for callers


def get_minio_client(app) -> Minio:
    return app.state.minio


def get_presigned_upload_url(
    client: Minio,
    bucket: str,
    key: str,
    expires_seconds: int = 3600,
) -> str:
    return client.presigned_put_object(
        bucket,
        key,
        expires=timedelta(seconds=expires_seconds),
    )


def get_presigned_download_url(
    client: Minio,
    bucket: str,
    key: str,
    expires_seconds: int = 3600,
) -> str:
    return client.presigned_get_object(
        bucket,
        key,
        expires=timedelta(seconds=expires_seconds),
    )


def get_proxy_download_url(
    bucket: str,
    key: str,
    api_url: str,
    signing_secret: str,
    expires: int = 3600,
) -> str:
    """Return a FastAPI-proxied download URL signed with HMAC-SHA256."""
    exp = int(time.time()) + expires
    payload = f"{bucket}:{key}:{exp}"
    sig = _hmac.new(signing_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    qs = urlencode({"bucket": bucket, "key": key, "exp": exp, "sig": sig})
    return f"{api_url.rstrip('/')}/api/reports/download?{qs}"


def upload_bytes(
    client: Minio,
    bucket: str,
    key: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> None:
    client.put_object(
        bucket,
        key,
        io.BytesIO(data),
        len(data),
        content_type=content_type,
    )


def download_bytes(client: Minio, bucket: str, key: str) -> bytes:
    response = client.get_object(bucket, key)
    return response.read()


def ensure_bucket(client: Minio, bucket: str) -> None:
    """Create bucket if it does not already exist."""
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
