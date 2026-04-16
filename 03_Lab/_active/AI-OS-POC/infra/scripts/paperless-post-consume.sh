#!/bin/bash
# Called by Paperless-ngx after a document is consumed.
# Environment: DOCUMENT_ID, DOCUMENT_FILE_NAME set by Paperless
# Fires webhook to aios-api for fast-path ingestion.

set -euo pipefail

AIOS_API="${AIOS_API_URL:-http://aios-api:3001}"
DOCUMENT_ID="${DOCUMENT_ID:-}"

if [ -z "$DOCUMENT_ID" ]; then
  echo "paperless-post-consume: DOCUMENT_ID not set, skipping" >&2
  exit 0
fi

curl -s -f -X POST "${AIOS_API}/internal/webhooks/paperless/document-consumed" \
  -H "Content-Type: application/json" \
  -d "{\"document_id\": ${DOCUMENT_ID}}" \
  && echo "paperless-post-consume: webhook fired for document_id=${DOCUMENT_ID}" \
  || echo "paperless-post-consume: webhook failed (poller will catch it)" >&2

exit 0
