# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Tambah arg agar rebuild paksa di Render tiap kali kamu ganti nilainya
ARG BUILD_ID=2025-10-29-2

# Copy manifest dulu untuk caching
COPY package.json ./
# Lockfile opsional: tidak error kalau tidak ada
COPY package-lock.json* ./

# Tampilkan versi & isi folder untuk debug
RUN node -v && npm -v && ls -la

# Install deps:
# - Jika ada package-lock.json -> npm ci (reproducible)
# - Jika tidak ada -> npm install (fallback)
# - Matikan audit/fund/scripts agar build lebih stabil
RUN set -eux; \
  if [ -f package-lock.json ]; then \
    echo ">>> Using npm ci"; \
    npm ci --omit=dev --no-audit --no-fund --ignore-scripts; \
  else \
    echo ">>> Using npm install"; \
    npm install --omit=dev --no-audit --no-fund --ignore-scripts; \
  fi

# Copy source code
COPY . .

EXPOSE 8080
CMD ["npm","start"]
