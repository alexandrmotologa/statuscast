# Multi-stage Dockerfile for StatusCast

# Stage 1: Build Web Frontend
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Build Server Backend
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_PATH=/app/data/statuscast.sqlite

# Install SQLite runtime dependencies
RUN apk add --no-cache python3 make g++

# Copy production server dependencies and compiled code
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY --from=server-builder /app/server/dist ./dist

# Copy compiled frontend assets
WORKDIR /app
COPY --from=web-builder /app/web/dist ./web/dist

# Create storage directory for SQLite database
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["node", "server/dist/index.js"]
