FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends osslsigncode msitools ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /relay
COPY docker/package-relay/worker.py ./worker.py
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
CMD ["python", "worker.py"]
