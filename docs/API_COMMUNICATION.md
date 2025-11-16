# API Communication Architecture

## Overview

This document explains how your React Router frontend communicates with the Hono backend API in a Docker environment.

## ⚠️ CRITICAL: Never Connect Frontend to PostgreSQL Directly

**NEVER** connect your React Router frontend directly to PostgreSQL. Always go through the API layer.

```
❌ WRONG: Browser → PostgreSQL
❌ WRONG: React Router SSR → PostgreSQL
✅ CORRECT: Browser → React Router SSR → Hono API → PostgreSQL
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Docker Network                        │
│                                                               │
│  ┌─────────────┐         ┌──────────────┐      ┌──────────┐ │
│  │             │         │              │      │          │ │
│  │  React      │ SSR     │   Hono API   │      │ Postgres │ │
│  │  Router     │────────▶│   Server     │─────▶│   DB     │ │
│  │  (web)      │ http:// │   (api)      │      │          │ │
│  │  Port 3000  │ api:9999│   Port 9999  │      │ Port     │ │
│  │             │         │              │      │ 5432     │ │
│  └─────────────┘         └──────────────┘      └──────────┘ │
│        ▲                                                     │
└────────┼─────────────────────────────────────────────────────┘
         │
         │ http://localhost:3000 (browser)
         │ http://yoursite.com (production)
         │
    ┌────┴─────┐
    │          │
    │ Browser  │
    │ (Client) │
    │          │
    └──────────┘
```

## Environment Variables

### Local Development (Outside Docker)

When running `pnpm dev` locally:

```bash
# No API_URL needed - defaults to localhost
# api.server.ts uses: http://localhost:9999
# api.client.ts uses: http://localhost:9999
```

Both server and client use `localhost` since everything runs on your local machine.

### Docker/Production (Inside Containers)

```bash
# apps/web container environment
API_URL=http://api:9999
```

- Used by [`api.server.ts`](app/lib/api.server.ts:1) for server-side rendering
- Uses Docker network hostname `api`
- Only accessible within the Docker network

### Client-Side (Browser) - Public Access

```bash
# Build-time variable (injected via Vite)
VITE_API_URL=http://localhost:9999  # Development
# or
VITE_API_URL=https://api.yoursite.com  # Production
```

- Used by [`api.client.ts`](app/lib/api.client.ts:1) for browser requests
- Must be a publicly accessible URL
- Set during Docker build via build args

## File Structure

```
apps/web/app/
├── lib/
│   ├── api.server.ts    # Server-side API client (uses http://api:9999)
│   └── api.client.ts    # Client-side API client (uses VITE_API_URL)
└── routes/
    └── tasks.tsx        # Example route using both
```

## Development Modes

### Local Development (Recommended for Development)

```bash
# Terminal 1: Start API
cd apps/api
pnpm dev

# Terminal 2: Start Frontend
cd apps/web
pnpm dev
```

Both services run on `localhost`:
- Frontend: `http://localhost:5173`
- API: `http://localhost:9999`
- [`api.server.ts`](app/lib/api.server.ts:1) automatically uses `localhost`

### Docker Development

```bash
docker-compose up
```

Services communicate via Docker network:
- Frontend: `http://localhost:3000` (browser)
- API (external): `http://localhost:9999` (browser)
- API (internal): `http://api:9999` (containers)


## Docker Network Configuration

### docker-compose.yml Configuration

```yaml
services:
  api:
    # ... api config
    ports:
      - 9999  # Internal port exposed to Docker network
    networks:
      - dokploy-network

  web:
    build:
      args:
        # Client-side URL (for browser)
        - VITE_API_URL=${VITE_API_URL:-http://localhost:9999}
    environment:
      # Server-side URL (for SSR, inside Docker)
      - API_URL=http://api:9999
    depends_on:
      - api
    networks:
      - dokploy-network
```

### How DNS Resolution Works

Within the Docker network:
- `api` → resolves to the API container IP
- `web` → resolves to the web container IP
- `postgres` → resolves to the PostgreSQL container IP

From outside (browser):
- `localhost:9999` → maps to host machine (development)
- `yoursite.com` → maps to your domain (production)

## Production Deployment

### Option 1: Same Domain (Recommended)

```yaml
# docker-compose.yml
environment:
  - VITE_API_URL=https://yoursite.com/api

# Use a reverse proxy (Traefik/Nginx) to route:
# yoursite.com/ → web container
# yoursite.com/api → api container
```

### Option 2: Separate Subdomains

```yaml
environment:
  - VITE_API_URL=https://api.yoursite.com

# Traefik labels:
# api.yoursite.com → api container
# www.yoursite.com → web container
```

### Option 3: Different Domains

```yaml
environment:
  - VITE_API_URL=https://api.example.com

# Don't forget CORS configuration in Hono API!
```

## CORS Configuration (If Needed)

If your API and frontend are on different domains, configure CORS in your Hono API:

```typescript
// apps/api/src/app.ts
import { cors } from 'hono/cors';

app.use('/*', cors({
  origin: ['https://yoursite.com', 'http://localhost:3000'],
  credentials: true,
}));
```

## Common Pitfalls

### ❌ Mistake 1: Using Wrong URL in SSR

```typescript
// WRONG - This won't work in Docker
const response = await fetch('http://localhost:9999/tasks');
```

```typescript
// CORRECT - Use Docker network hostname
const response = await fetch('http://api:9999/tasks');
```

### ❌ Mistake 2: Connecting to PostgreSQL Directly

```typescript
// WRONG - Never do this from frontend
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

```typescript
// CORRECT - Always use the API
import * as api from '~/lib/api.server';
const tasks = await api.getTasks();
```

### ❌ Mistake 3: Mixing Client and Server APIs

```typescript
// WRONG - Using client API in a loader
import * as apiClient from '~/lib/api.client';

export async function loader() {
  return await apiClient.getTasks(); // Will fail in SSR
}
```

```typescript
// CORRECT - Use server API in loaders
import * as apiServer from '~/lib/api.server';

export async function loader() {
  return await apiServer.getTasks(); // Works in SSR
}
```

## Testing

### Local Development

```bash
# Terminal 1: API
cd apps/api
pnpm dev

# Terminal 2: Frontend
cd apps/web
pnpm dev

# Access:
# Frontend: http://localhost:5173
# API: http://localhost:9999
# API Docs: http://localhost:9999/reference
```

### Docker Development

```bash
docker-compose up --build

# Access:
# Frontend: http://localhost:3000
# API: http://localhost:9999
# API Docs: http://localhost:9999/reference
```

### Verify API Communication

```bash
# Test API directly
curl http://localhost:9999/tasks

# Test from within web container (Docker only)
docker-compose exec web curl http://api:9999/tasks
```

## Summary

1. **Server-Side (SSR)**: Use [`api.server.ts`](app/lib/api.server.ts:1) with `http://api:9999`
2. **Client-Side (Browser)**: Use [`api.client.ts`](app/lib/api.client.ts:1) with `VITE_API_URL`
3. **Never** connect frontend directly to PostgreSQL
4. **Prefer** Form-based mutations over client-side API calls
5. **Configure** CORS if API and frontend are on different domains

## Resources

- [React Router Data Loading](https://reactrouter.com/en/main/route/loader)
- [React Router Forms](https://reactrouter.com/en/main/components/form)
- [Hono Documentation](https://hono.dev/)
- [Docker Networking](https://docs.docker.com/network/)
