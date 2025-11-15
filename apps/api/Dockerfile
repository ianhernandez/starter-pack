# Development dependencies stage
FROM node:22-alpine AS development-dependencies-env
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Production dependencies stage
FROM node:22-alpine AS production-dependencies-env
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Test stage
FROM node:22-alpine AS test-env
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . ./
COPY --from=development-dependencies-env /app/node_modules ./node_modules
# Run tests (will fail build if tests fail)
RUN pnpm test --run

# Build stage
FROM node:22-alpine AS build-env
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . ./
COPY --from=development-dependencies-env /app/node_modules ./node_modules
RUN pnpm build

# Production stage
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json ./
COPY --from=production-dependencies-env /app/node_modules ./node_modules
COPY --from=build-env /app/dist ./dist
# Copy migration files and drizzle config for database migrations
COPY drizzle.config.ts ./
COPY src/db/migrations ./src/db/migrations
# Copy and setup entrypoint script for migrations
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 9999
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "start"]
