# Dockerfile (stable, Debian base + fallback when no lockfile)
FROM node:20-bullseye-slim

ENV NODE_ENV=production \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false

# Toolchain ringan untuk modul native + CA TLS
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bust cache mudah saat perlu
ARG BUILD_ID=2025-10-29-tnemyap-v1

# Copy manifests
COPY package.json ./
# Lockfile opsional (pakai wildcard)
COPY package-lock.json* ./

# Install deps:
# - ada lockfile  -> npm ci
# - tidak ada     -> npm install
RUN set -eux; \
  if [ -f package-lock.json ]; then \
    echo ">>> Using npm ci"; \
    npm ci --omit=dev; \
  else \
    echo ">>> Using npm install"; \
    npm install --omit=dev; \
  fi

# Copy source code
COPY . .

EXPOSE 8080
CMD ["npm","start"]
