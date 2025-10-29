# Dockerfile
FROM node:20-bookworm-slim

# Tools untuk modul native (pg) + SSL
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    python3 build-essential pkg-config libpq-dev ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Salin manifest dulu untuk caching
COPY package.json package-lock.json* ./

# 1-liner fallback: coba `npm ci`, kalau gagal (mis. lockfile tidak ada) → `npm install`
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev || npm install --omit=dev

# Salin sisa source
COPY . .

# Jalankan di port Render
ENV PORT=8080
EXPOSE 8080

# Start server
CMD ["node", "src/server.js"]
