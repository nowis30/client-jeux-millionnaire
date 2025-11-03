# Build client with monorepo context
FROM node:20-alpine AS base
WORKDIR /app

# Copy manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY client/package*.json ./client/

RUN npm ci

# Copy sources
COPY shared ./shared
COPY client ./client

WORKDIR /app/client

ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
