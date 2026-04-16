FROM python:3.12-slim

WORKDIR /app

# System deps for PyMuPDF + PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer cache)
COPY comply/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

ENV PYTHONPATH=/app/shared

# Copy service code + shared
COPY shared/ ./shared/
COPY comply/ ./

EXPOSE 8010
CMD ["uvicorn", "comply_server:app", "--host", "0.0.0.0", "--port", "8010"]
