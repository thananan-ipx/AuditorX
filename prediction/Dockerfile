FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER 10001:10001
EXPOSE 8090
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=12 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8090/health', timeout=2)"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090", "--limit-concurrency", "32", "--no-access-log"]
