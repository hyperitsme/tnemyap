# Dockerfile
FROM node:20-bookworm-slim

# Paket build utk modul native (pg) + libpq
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    python3 build-essential pkg-config libpq-dev ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifest dulu agar layer cache efektif
COPY package.json package-lock.json* ./

# Pakai npm ci kalau ada lockfile; fallback ke npm install kalau tidak ada
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then \
      echo ">>> Using npm ci"; \
      npm ci --omit=dev; \
    else \
      echo ">>> Using npm install"; \
      npm install --omit=dev; \
    fi

# Copy source
COPY . .

# Pastikan service listen di PORT yg diberikan Render
ENV PORT=8080
EXPOSE 8080

# Start server
CMD ["node", "src/server.js"]
