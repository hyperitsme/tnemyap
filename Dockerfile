# Dockerfile
FROM node:20-bookworm-slim

# Tools untuk modul native & SSL
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    python3 build-essential pkg-config libpq-dev ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Salin manifest
COPY package.json package-lock.json* ./

# Install deps: coba npm ci (kalau ada lockfile), kalau gagal fallback ke npm install
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev || npm install --omit=dev

# Salin source
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]
