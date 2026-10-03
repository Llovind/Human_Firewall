FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY requirements-ml.txt .
RUN pip install --no-cache-dir -r requirements-ml.txt

COPY . .

RUN useradd -r -s /bin/false flaskuser \
    && chown -R flaskuser:flaskuser /app
USER flaskuser

EXPOSE 5000

CMD ["gunicorn", "--bind=0.0.0.0:5000", "--worker-class=gthread", "--workers=1", "--threads=16", "--timeout=120", "--access-logfile=-", "app:app"]
