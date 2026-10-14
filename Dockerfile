# Multi-Stage Production Dockerfile for Enterprise ITAM

# Stage 1: Build React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend Application
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
# Copy Postgres schema to default prisma schema for production
RUN cp prisma/schema.postgresql.prisma prisma/schema.prisma
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install OpenSSL for Prisma engine
RUN apk add --no-cache openssl

# Set up backend runtime
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /app/backend/node_modules/@prisma ./node_modules/@prisma
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=backend-builder /app/backend/src/docs ./dist/docs

# Copy built frontend assets into public directory
COPY --from=frontend-builder /app/frontend/dist /app/backend/public

# Create uploads directory
RUN mkdir -p /app/backend/uploads && chown -R node:node /app

USER node
EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.postgresql.prisma && node dist/server.js"]
