# Dockerfile (stabil – Debian base)
FROM node:20-bullseye-slim

ENV NODE_ENV=production \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false

# Install build tools (aman untuk modul native; ringan)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests dulu (cache-friendly)
COPY package.json ./
COPY package-lock.json ./

# Instal strictly sesuai lockfile (deterministik)
RUN npm ci --omit=dev

# Baru copy source lain
COPY . .

EXPOSE 8080
CMD ["npm","start"]
