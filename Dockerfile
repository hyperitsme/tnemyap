FROM node:20-alpine
WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts

COPY . .
EXPOSE 8080
CMD ["npm","start"]
