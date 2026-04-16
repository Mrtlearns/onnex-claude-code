#!/bin/bash
# Upload sample documents to RAGv1 and trigger processing
# Runs ON poc-backend (10.10.110.34) via SSH

set -e

# Config
SUPABASE_URL="http://localhost:8000"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc0NDQ4NDU0LCJleHAiOjE5MzIxMjg0NTR9.kf4_44X5fTW7fh_b7EeAowDbYq8bw4YYAKqdRdkaQGk"
API_KEY="ragv1-smoke-2026"
PROJECT_ID=1
BUCKET="poc-ragv1-docs"
DOCS_DIR="/tmp/sample-docs"

# Get service role key
SERVICE_ROLE_KEY=$(docker exec supabase-kong env 2>/dev/null | grep SUPABASE_SERVICE_KEY | cut -d= -f2)
if [ -z "$SERVICE_ROLE_KEY" ]; then
  SERVICE_ROLE_KEY=$(cat /opt/stacks/supabase/.env 2>/dev/null | grep SERVICE_ROLE_KEY= | cut -d= -f2 | tr -d '"')
fi

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "ERROR: Could not find SERVICE_ROLE_KEY"
  exit 1
fi
echo "Service role key: ${SERVICE_ROLE_KEY:0:30}..."

# Get ragv1-api internal URL (edge function)
RAGV1_API_URL="${SUPABASE_URL}/functions/v1/ragv1-api"
echo "ragv1-api URL: $RAGV1_API_URL"

# Process each document
for filepath in "$DOCS_DIR"/*.txt; do
  filename=$(basename "$filepath")
  echo ""
  echo "=== Processing: $filename ==="

  # Build storage path
  TIMESTAMP=$(date +%s%3N)
  STORAGE_PATH="${PROJECT_ID}/${TIMESTAMP}_${filename}"

  # Upload to storage using service role
  echo "Uploading to storage: $STORAGE_PATH"
  UPLOAD_RESULT=$(curl -s -X POST \
    "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${STORAGE_PATH}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: text/plain" \
    --data-binary "@${filepath}")
  echo "Storage: $UPLOAD_RESULT"

  # Insert document record into DB
  echo "Creating document record..."
  DOC_INSERT=$(curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/documents" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Accept-Profile: poc_ragv1" \
    -H "Content-Profile: poc_ragv1" \
    -H "Prefer: return=representation" \
    -d "{\"project_id\":${PROJECT_ID},\"name\":\"${filename}\",\"file_type\":\"text/plain\",\"source_path\":\"${STORAGE_PATH}\",\"status\":\"pending\"}")
  echo "Doc insert: $DOC_INSERT"

  # Extract doc ID
  DOC_ID=$(echo "$DOC_INSERT" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  if [ -z "$DOC_ID" ]; then
    echo "ERROR: Could not get document ID from insert response"
    continue
  fi
  echo "Document ID: $DOC_ID"

  # Trigger processing via ragv1-api
  echo "Triggering processing for document $DOC_ID..."
  PROCESS_RESULT=$(curl -s -X POST \
    "${RAGV1_API_URL}/v1/documents" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"document_id\":${DOC_ID}}")
  echo "Process trigger: $PROCESS_RESULT"

  # Small delay between uploads
  sleep 2
done

echo ""
echo "=== All documents submitted. Waiting for processing... ==="
sleep 10

# Poll status
echo ""
echo "=== Document Status ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT id, name, status FROM poc_ragv1.documents WHERE project_id=${PROJECT_ID} ORDER BY id;"

echo ""
echo "=== Entity Count ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) as entity_count FROM poc_ragv1.entities WHERE project_id=${PROJECT_ID};"

echo ""
echo "=== Relation Count ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) as relation_count FROM poc_ragv1.entity_relations WHERE project_id=${PROJECT_ID};"
