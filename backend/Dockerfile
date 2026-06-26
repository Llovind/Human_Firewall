FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -r -s /bin/false flaskuser \
    && chown -R flaskuser:flaskuser /app
USER flaskuser

EXPOSE 5000

CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]