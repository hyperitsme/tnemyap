# Dockerfile
FROM node:20-alpine

WORKDIR /app

# copy manifest dulu (biar cache bagus)
COPY package.json ./
# copy lockfile kalau ada (wildcard supaya tidak error saat tidak ada)
COPY package-lock.json* ./

# install deps:
# - kalau ada lockfile: npm ci
# - kalau tidak ada: npm install
RUN set -eux; \
  if [ -f package-lock.json ]; then \
    npm ci --omit=dev; \
  else \
    npm install --omit=dev; \
  fi

# baru copy source lainnya
COPY . .

EXPOSE 8080
CMD ["npm","start"]
