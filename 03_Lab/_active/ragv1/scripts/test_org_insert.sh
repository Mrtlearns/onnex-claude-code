#!/bin/bash
ANON=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc0NDQ4NDU0LCJleHAiOjE5MzIxMjg0NTR9.kf4_44X5fTW7fh_b7EeAowDbYq8bw4YYAKqdRdkaQGk
TOKEN=$(curl -s -X POST "http://localhost:8000/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"mrtmaharaj@gmail.com","password":"Poll0000"}' | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:40}..."
echo "--- Testing INSERT into organizations ---"
RESULT=$(curl -s -X POST "http://localhost:8000/rest/v1/organizations" \
  -H "apikey: $ANON" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: poc_ragv1" \
  -H "Content-Profile: poc_ragv1" \
  -H "Prefer: return=representation" \
  -d '{"name":"Onnex Test UI","slug":"onnex-test-ui","owner_id":"62993da8-a4cc-40e7-9c20-353168f3b03f"}')
echo "Result: $RESULT"
echo "--- Cleanup ---"
docker exec supabase-db psql -U postgres -d postgres -c "DELETE FROM poc_ragv1.organizations WHERE slug='onnex-test-ui';"
