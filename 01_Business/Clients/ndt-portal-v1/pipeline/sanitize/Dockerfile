FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY sanitize/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download en_core_web_sm

ENV PYTHONPATH=/app/shared

COPY shared/ ./shared/
COPY sanitize/ ./

EXPOSE 8011
CMD ["uvicorn", "sanitize_server:app", "--host", "0.0.0.0", "--port", "8011"]
