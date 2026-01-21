FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for pdfplumber
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Cloud Run injects $PORT (default 8080). Expose 8080 for clarity.
EXPOSE 8080

# Run uvicorn (bind to $PORT when present - required by Cloud Run)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
