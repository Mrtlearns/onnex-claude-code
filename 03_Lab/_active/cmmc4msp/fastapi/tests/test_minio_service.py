"""Unit tests for app/services/minio_service.py — pure unit tests, no router needed."""
from __future__ import annotations

import io
from datetime import timedelta
from unittest.mock import MagicMock, call

import pytest

from app.services.minio_service import (
    ensure_bucket,
    download_bytes,
    get_presigned_download_url,
    get_presigned_upload_url,
    upload_bytes,
)


def _mock_minio() -> MagicMock:
    return MagicMock()


# ---------------------------------------------------------------------------
# get_presigned_upload_url
# ---------------------------------------------------------------------------


def test_presigned_upload_url_calls_put_object():
    client = _mock_minio()
    client.presigned_put_object.return_value = "https://minio/bucket/key?sig=abc"

    url = get_presigned_upload_url(client, "cmmc-artifacts", "org-123/file.pdf", expires_seconds=3600)

    client.presigned_put_object.assert_called_once_with(
        "cmmc-artifacts",
        "org-123/file.pdf",
        expires=timedelta(seconds=3600),
    )
    assert url == "https://minio/bucket/key?sig=abc"


def test_presigned_upload_url_custom_expiry():
    client = _mock_minio()
    client.presigned_put_object.return_value = "https://minio/url"

    get_presigned_upload_url(client, "bucket", "key", expires_seconds=7200)

    _, kwargs = client.presigned_put_object.call_args
    assert kwargs.get("expires") == timedelta(seconds=7200) or \
        client.presigned_put_object.call_args[0][2] == timedelta(seconds=7200)


# ---------------------------------------------------------------------------
# get_presigned_download_url
# ---------------------------------------------------------------------------


def test_presigned_download_url_calls_get_object():
    client = _mock_minio()
    client.presigned_get_object.return_value = "https://minio/bucket/key?dl=1"

    url = get_presigned_download_url(client, "cmmc-reports", "prog/ssp.pdf")

    client.presigned_get_object.assert_called_once_with(
        "cmmc-reports",
        "prog/ssp.pdf",
        expires=timedelta(seconds=3600),
    )
    assert url == "https://minio/bucket/key?dl=1"


def test_presigned_download_url_custom_expiry():
    client = _mock_minio()
    client.presigned_get_object.return_value = "https://minio/url"

    get_presigned_download_url(client, "bucket", "key", expires_seconds=1800)

    args = client.presigned_get_object.call_args[0]
    # positional call: (bucket, key, expires=...)
    assert args[0] == "bucket"
    assert args[1] == "key"


# ---------------------------------------------------------------------------
# upload_bytes
# ---------------------------------------------------------------------------


def test_upload_bytes_calls_put_object_with_stream():
    client = _mock_minio()
    data = b"PDF content goes here"

    upload_bytes(client, "cmmc-artifacts", "org/file.pdf", data, "application/pdf")

    assert client.put_object.called
    call_args = client.put_object.call_args[0]
    assert call_args[0] == "cmmc-artifacts"
    assert call_args[1] == "org/file.pdf"
    assert isinstance(call_args[2], io.BytesIO)
    assert call_args[3] == len(data)


def test_upload_bytes_default_content_type():
    client = _mock_minio()
    upload_bytes(client, "bucket", "key", b"data")

    call_args = client.put_object.call_args
    # content_type is the 5th positional arg or keyword
    args = call_args[0]
    kwargs = call_args[1] if len(call_args) > 1 else {}
    content_type = args[4] if len(args) > 4 else kwargs.get("content_type", "application/octet-stream")
    assert content_type == "application/octet-stream"


def test_upload_bytes_stream_position():
    """BytesIO passed to put_object should be readable from position 0."""
    client = _mock_minio()
    data = b"hello world"
    upload_bytes(client, "bucket", "key", data)

    stream_arg = client.put_object.call_args[0][2]
    assert stream_arg.read() == data


# ---------------------------------------------------------------------------
# download_bytes
# ---------------------------------------------------------------------------


def test_download_bytes_calls_get_object_and_reads():
    client = _mock_minio()
    mock_response = MagicMock()
    mock_response.read.return_value = b"downloaded content"
    client.get_object.return_value = mock_response

    result = download_bytes(client, "cmmc-artifacts", "org/file.pdf")

    client.get_object.assert_called_once_with("cmmc-artifacts", "org/file.pdf")
    assert result == b"downloaded content"


def test_download_bytes_propagates_s3_error():
    from minio.error import S3Error
    client = _mock_minio()
    client.get_object.side_effect = S3Error(
        "NoSuchKey", "The object does not exist.", "org/file.pdf", "request-id", "host-id", MagicMock()
    )

    with pytest.raises(S3Error):
        download_bytes(client, "bucket", "org/file.pdf")


# ---------------------------------------------------------------------------
# ensure_bucket
# ---------------------------------------------------------------------------


def test_ensure_bucket_creates_when_missing():
    client = _mock_minio()
    client.bucket_exists.return_value = False

    ensure_bucket(client, "cmmc-artifacts")

    client.bucket_exists.assert_called_once_with("cmmc-artifacts")
    client.make_bucket.assert_called_once_with("cmmc-artifacts")


def test_ensure_bucket_skips_creation_when_exists():
    client = _mock_minio()
    client.bucket_exists.return_value = True

    ensure_bucket(client, "cmmc-artifacts")

    client.bucket_exists.assert_called_once_with("cmmc-artifacts")
    client.make_bucket.assert_not_called()
