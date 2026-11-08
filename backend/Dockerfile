# Stage 1: build dependencies that need a compiler.
FROM python:3.10-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Stage 2: runtime image — no compiler, no -dev headers, non-root.
FROM python:3.10-slim AS runtime

RUN groupadd --system appuser && \
    useradd --system --gid appuser --home-dir /app --shell /sbin/nologin appuser

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    APP_ENV=prod

WORKDIR /app

# Create directories that get bind-mounted as named volumes so they have the
# right ownership the first time Docker populates the volume from the image.
RUN mkdir -p /var/log/gunicorn /var/log/celery /app/staticfiles /mnt/safaridesk && \
    chown -R appuser:appuser /app /var/log/gunicorn /var/log/celery /mnt/safaridesk

COPY --chown=appuser:appuser . /app/

EXPOSE 8100
USER appuser

# docker-compose.yml overrides this with gunicorn/daphne/celery worker/celery beat
# per service; this is only the fallback for running the image standalone.
CMD ["gunicorn", "RNSafarideskBack.wsgi:application", "--bind", "0.0.0.0:8100", "--workers", "3"]
