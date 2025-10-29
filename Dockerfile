# Dockerfile (diagnostic)
FROM node:20-alpine
WORKDIR /app
ARG BUILD_ID=2025-10-29-DBG3

# 1) Copy manifests
COPY package.json ./
COPY package-lock.json* ./

# 2) Print environment info & manifest
RUN set -eux; \
    node -v; npm -v; ls -la; \
    echo "----- package.json -----"; cat package.json || true; echo "------------------------";

# 3) Install deps (ci jika ada lock, else install) + dump log jika gagal
RUN set -eux; \
  if [ -f package-lock.json ]; then \
    echo ">>> Using npm ci"; \
    npm ci --omit=dev --no-audit --no-fund --ignore-scripts --loglevel=verbose \
    || (echo ">>> npm ci failed. Dumping logs..." && ls -la /root/.npm/_logs || true && cat /root/.npm/_logs/*-debug-0.log || true && exit 1); \
  else \
    echo ">>> Using npm install"; \
    npm install --omit=dev --no-audit --no-fund --ignore-scripts --loglevel=verbose \
    || (echo ">>> npm install failed. Dumping logs..." && ls -la /root/.npm/_logs || true && cat /root/.npm/_logs/*-debug-0.log || true && exit 1); \
  fi

# 4) Copy source code
COPY . .
EXPOSE 8080
CMD ["npm","start"]
