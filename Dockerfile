FROM node:20-alpine

WORKDIR /app

# Copy manifests for caching
COPY package.json ./
COPY package-lock.json* ./

# Install dependencies
RUN set -eux; \
  if [ -f package-lock.json ]; then \
    npm ci --omit=dev; \
  else \
    npm install --omit=dev; \
  fi

# Copy the rest
COPY . .

EXPOSE 8080
CMD ["npm","start"]
