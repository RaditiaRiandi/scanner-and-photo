FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (build-essential, libpq-dev for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Buat direktori photos jika belum ada
RUN mkdir -p /app/photos

EXPOSE 8089

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8089"]
