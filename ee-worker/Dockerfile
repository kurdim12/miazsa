# MIZAN EE Worker — container image (docs/05 §1.2, docs/18-deployment.md).
# Python 3.11 slim base, non-root user, Cloud Run-friendly (listens on $PORT/8080).

FROM python:3.11-slim AS base

# Faster, quieter, predictable Python in containers.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

# Install dependencies first for better layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code.
COPY app ./app

# Run as a non-root user (least privilege).
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

# Liveness check hits the unauthenticated /health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os,urllib.request,sys; \
        port=os.environ.get('PORT','8080'); \
        sys.exit(0 if urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=4).status==200 else 1)"

# Cloud Run injects $PORT; default to 8080 locally. Shell form so $PORT expands.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
