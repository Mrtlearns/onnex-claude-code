FROM python:3.12-slim

WORKDIR /app

# Install Node.js 20 + claude CLI for OAuth-authenticated LLM calls
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && rm -rf /var/lib/apt/lists/*

COPY gateway/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download en_core_web_sm

ENV PYTHONPATH=/app/shared

COPY shared/ ./shared/
COPY gateway/ ./

EXPOSE 8012
CMD ["uvicorn", "gateway_server:app", "--host", "0.0.0.0", "--port", "8012"]
