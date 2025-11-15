FROM node:22-alpine AS development-dependencies-env
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS production-dependencies-env
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS build-env
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . ./
COPY --from=development-dependencies-env /app/node_modules ./node_modules
RUN pnpm build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json ./
COPY --from=production-dependencies-env /app/node_modules ./node_modules
COPY --from=build-env /app/build ./build
EXPOSE 3000
CMD ["pnpm", "start"]
