# Use the base Python image
FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libglib2.0-dev \
    libgirepository1.0-dev \
    libpango1.0-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*


# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create necessary log directories
RUN mkdir -p /var/log/gunicorn /var/log/celery
RUN chmod -R 777 /var/log/gunicorn /var/log/celery

# Copy application code
COPY . /app/

# Set environment variables
ENV APP_ENV=prod
EXPOSE 8100

# docker-compose.yml overrides this with gunicorn/daphne/celery worker/celery beat
# per service; this is only the fallback for running the image standalone.
CMD ["gunicorn", "RNSafarideskBack.wsgi:application", "--bind", "0.0.0.0:8100", "--workers", "3"]

