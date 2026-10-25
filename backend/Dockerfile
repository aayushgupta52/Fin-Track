FROM node:20-slim

# System deps for Prisma (openssl) and Sharp/OCR image processing
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifest + Prisma schema first so `npm ci` (postinstall: prisma generate)
# can find the schema and the layer caches on dependency changes only.
COPY package*.json ./
COPY prisma ./prisma
# Prisma's postinstall reads the datasource env vars while generating its client.
# Use build-only placeholders; real values must be supplied at runtime.
RUN DATABASE_URL="postgresql://user:password@localhost:5432/fintrack?schema=public" \
    DIRECT_URL="postgresql://user:password@localhost:5432/fintrack?schema=public" \
    npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
