FROM python:3.11-slim

WORKDIR /app

# Install system deps needed by lxml / pandas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# SQLite DB lives in a mounted volume at /data
ENV DB_PATH=/data/stockiq.db

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
