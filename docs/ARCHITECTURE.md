# System Architecture

## Table of Contents

1. [Overview](#overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Infrastructure & Deployment](#infrastructure--deployment)
6. [Data Flow](#data-flow)
7. [API Architecture](#api-architecture)
8. [Frontend Architecture](#frontend-architecture)
9. [Development Environments](#development-environments)
10. [Design Principles](#design-principles)
11. [Related Documentation](#related-documentation)

---

## Overview

This is a full-stack, type-safe web application built with modern JavaScript technologies. The system follows a monorepo structure with three main services: a PostgreSQL database, a Hono REST API backend, and a React Router frontend with server-side rendering (SSR).

### Core Characteristics

- **Type-Safe End-to-End**: Full TypeScript coverage from database to client
- **Contract-First API**: OpenAPI-compliant REST API with automatic documentation
- **Monorepo Architecture**: Multiple apps managed in a single repository
- **Docker-First Deployment**: Containerized services with Docker Compose orchestration
- **SSR-Capable Frontend**: React Router with server-side rendering support
- **Development-Focused**: Hot reload, interactive docs, structured logging

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Docker Network                              │
│                                                                   │
│  ┌──────────────┐        ┌───────────────┐       ┌────────────┐ │
│  │              │        │               │       │            │ │
│  │   React      │  SSR   │   Hono API    │       │ PostgreSQL │ │
│  │   Router     │───────▶│   (Node.js)   │──────▶│    16      │ │
│  │   (apps/web) │ http://│  (apps/api)   │       │            │ │
│  │              │ api:9999│               │       │            │ │
│  │   Port 3000  │        │   Port 9999   │       │ Port 5432  │ │
│  │              │        │               │       │            │ │
│  └──────────────┘        └───────────────┘       └────────────┘ │
│        ▲                                                         │
└────────┼─────────────────────────────────────────────────────────┘
         │
         │ Browser Access
         │ http://localhost:3000 (dev)
         │ https://yoursite.com (prod)
         │
    ┌────┴─────┐
    │          │
    │ Browser  │
    │ (Client) │
    │          │
    └──────────┘
```

### Service Communication

- **Browser → Web Container**: Public HTTP/HTTPS access
- **Web Container → API Container**: Internal Docker network (`http://api:9999`)
- **API Container → PostgreSQL**: Internal Docker network (`postgres://postgres:5432`)
- **Browser → API** (optional): Direct access for client-side calls (`http://localhost:9999`)

---

## Technology Stack

### Backend API (apps/api)

| Technology | Version | Purpose |
|------------|---------|---------|
| **Hono** | 4.x | Ultrafast, runtime-agnostic web framework |
| **@hono/zod-openapi** | 1.x | OpenAPI integration with Zod validation |
| **Zod** | 4.x | TypeScript-first schema validation |
| **Drizzle ORM** | 0.44.x | Type-safe SQL ORM with excellent migrations |
| **drizzle-zod** | 0.8.x | Bridge between Drizzle schemas and Zod |
| **PostgreSQL** | 16 | Production-grade relational database |
| **Pino** | 10.x | High-performance structured logging |
| **Vitest** | 3.x | Fast, modern test runner |
| **Scalar** | 0.9.x | Beautiful interactive API documentation |
| **Stoker** | 2.x | Utility library for Hono + OpenAPI patterns |

### Frontend Web (apps/web)

| Technology | Version | Purpose |
|------------|---------|---------|
| **React Router** | 7.x | Modern React framework with SSR |
| **React** | 19.x | UI library |
| **Vite** | 7.x | Fast build tool and dev server |
| **TailwindCSS** | 4.x | Utility-first CSS framework |
| **TypeScript** | 5.x | Type-safe JavaScript |

### Infrastructure

| Technology | Version | Purpose |
|------------|---------|---------|
| **Docker** | Latest | Containerization |
| **Docker Compose** | Latest | Multi-container orchestration |
| **PostgreSQL** | 16-alpine | Database container |
| **Node.js** | Latest | Runtime environment |

---

## Project Structure

### Monorepo Layout

```
stater-pack/
├── docker-compose.yml          # Multi-service orchestration
├── docs/                       # Project documentation
│   ├── ARCHITECTURE.md        # This document
│   ├── API_COMMUNICATION.md   # API integration guide
│   └── QUICK_START.md         # Getting started guide
│
├── apps/
│   ├── api/                   # Backend API service
│   │   ├── src/
│   │   │   ├── app.ts         # Runtime-agnostic app definition
│   │   │   ├── index.ts       # Node.js entry point
│   │   │   ├── env.ts         # Type-safe environment config
│   │   │   ├── db/            # Database layer
│   │   │   │   ├── index.ts   # DB connection
│   │   │   │   ├── schema.ts  # Drizzle tables + Zod schemas
│   │   │   │   └── migrations/
│   │   │   ├── lib/           # Shared utilities
│   │   │   │   ├── configure-open-api.ts
│   │   │   │   ├── create-app.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── constants.ts
│   │   │   ├── middlewares/   # Custom middleware
│   │   │   │   └── pino-logger.ts
│   │   │   └── features/      # Feature modules
│   │   │       └── tasks/
│   │   │           ├── tasks.index.ts    # Router
│   │   │           ├── tasks.routes.ts   # OpenAPI contracts
│   │   │           ├── tasks.handlers.ts # Implementations
│   │   │           └── tasks.test.ts     # Tests
│   │   ├── docs/              # API documentation
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── drizzle.config.ts
│   │
│   └── web/                   # Frontend web service
│       ├── app/
│       │   ├── root.tsx       # App root component
│       │   ├── routes.ts      # Route configuration
│       │   ├── lib/           # Utilities
│       │   └── routes/        # Page components
│       │       ├── home.tsx
│       │       └── tasks.tsx
│       ├── public/            # Static assets
│       ├── Dockerfile
│       ├── package.json
│       └── vite.config.ts
```

---

## Infrastructure & Deployment

### Docker Compose Configuration

#### Services

**1. PostgreSQL Database**
```yaml
postgres:
  image: postgres:16-alpine
  ports: ["5432:5432"]
  environment:
    POSTGRES_DB: api_db
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  volumes:
    - postgres-data:/var/lib/postgresql/data
  healthcheck: pg_isready check
```

**2. Hono API Backend**
```yaml
api:
  build: ./apps/api
  ports: ["9999"]
  environment:
    NODE_ENV: production
    PORT: 9999
    DATABASE_URL: postgres://postgres:postgres@postgres:5432/api_db
  depends_on:
    postgres: { condition: service_healthy }
  healthcheck: HTTP health check on /
```

**3. React Router Web Frontend**
```yaml
web:
  build: ./apps/web
  ports: ["3000"]
  environment:
    # SSR uses internal Docker hostname
    API_URL: http://api:9999
  build_args:
    # Browser uses public URL
    VITE_API_URL: ${VITE_API_URL:-http://localhost:9999}
  depends_on: [api]
```

### Network Architecture

- **dokploy-network**: External Docker network for service discovery
- **DNS Resolution**: Service names (`api`, `web`, `postgres`) resolve to container IPs
- **Port Mapping**: Containers expose ports internally, mapped externally for access

### Production Deployment

The system is designed for deployment on platforms supporting Docker:

- **Traefik Labels**: Pre-configured for reverse proxy routing
- **Health Checks**: All services have health check endpoints
- **SSL/TLS**: Configured for Let's Encrypt certificate resolution
- **Domain Routing**: Traefik routes based on hostnames


### 3. Type Flow (Compile-Time)

```
PostgreSQL Schema Definition (Drizzle)
    │
    ▼
Zod Schemas (drizzle-zod auto-generation)
    │
    ├─▶ selectTasksSchema  (for reading)
    ├─▶ insertTasksSchema  (for creating)
    └─▶ patchTasksSchema   (for updating)
        │
        ▼
OpenAPI Route Definitions
    │
    ├─▶ Request validation schemas
    └─▶ Response type definitions
        │
        ▼
Route Handler Types
    │
    └─▶ AppRouteHandler<typeof route>
        │
        ▼
TypeScript ensures type safety at compile time
```

---

## API Architecture

### Core Philosophy

1. **Contract-First Design**: Routes defined as OpenAPI specifications before implementation
2. **Single Source of Truth**: Database schema drives all validation
3. **Type Safety**: Full TypeScript inference from DB to response
4. **Automatic Documentation**: OpenAPI spec generated from code

### Architecture Pattern

```
┌──────────────────────────────────────────────────────┐
│                   Request Flow                        │
└──────────────────────────────────────────────────────┘

Request
  │
  ├─▶ Middleware Pipeline
  │   ├─▶ Request ID injection
  │   ├─▶ Emoji favicon
  │   └─▶ Pino structured logging
  │
  ├─▶ Route Matching (Hono router)
  │
  ├─▶ Request Validation (Zod)
  │   └─▶ Returns 400 if validation fails
  │
  ├─▶ Route Handler Execution
  │   ├─▶ Business logic
  │   ├─▶ Database queries (Drizzle ORM)
  │   └─▶ Response formatting
  │
  └─▶ Response
      ├─▶ Auto-validated against schema
      └─▶ Documented in OpenAPI spec
```

### Feature Module Pattern

Each feature (e.g., `tasks`) follows this structure:

**1. Database Schema** (`db/schema.ts`)
```typescript
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  done: boolean("done").default(false),
});
```

**2. Zod Schemas** (auto-generated)
```typescript
export const selectTasksSchema = createSelectSchema(tasks);
export const insertTasksSchema = createInsertSchema(tasks);
```

**3. Route Definitions** (`tasks.routes.ts`)
```typescript
export const list = createRoute({
  method: "get",
  path: "/tasks",
  responses: {
    200: jsonContent(z.array(selectTasksSchema), "Task list"),
  },
});
```

**4. Route Handlers** (`tasks.handlers.ts`)
```typescript
export const list: AppRouteHandler<typeof listRoute> = async (c) => {
  const tasks = await db.query.tasks.findMany();
  return c.json(tasks);
};
```

**5. Router Assembly** (`tasks.index.ts`)
```typescript
const router = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.create, handlers.create);
```

### API Documentation

- **Endpoint**: `GET /reference`
- **Technology**: Scalar UI
- **Features**:
  - Interactive API testing
  - Auto-generated from OpenAPI spec
  - Code examples in multiple languages
  - Beautiful, modern interface

---

## Frontend Architecture

### React Router SSR Architecture

```
┌─────────────────────────────────────────────────┐
│           React Router Request Cycle             │
└─────────────────────────────────────────────────┘

Browser Request
    │
    ├─▶ Server-Side (Node.js)
    │   │
    │   ├─▶ Route matching
    │   ├─▶ Loader execution (data fetching via fetch)
    │   │   └─▶ Fetches from API (http://api:9999)
    │   ├─▶ Component rendering
    │   └─▶ HTML generation
    │
    └─▶ Client-Side Hydration
        │
        ├─▶ React takes over
        ├─▶ Interactive JavaScript loads
        └─▶ Subsequent navigations use client-side routing
```

### API Communication

**Request Patterns**

1. **Server-Side Requests** (in Loaders/Actions)
   - Uses: Standard `fetch()` API
   - Targets: `http://api:9999` (Docker internal network)
   - Purpose: SSR data fetching
   - Environment: Node.js server context

2. **Client-Side Requests** (in Browser)
   - Uses: Standard `fetch()` API
   - Targets: `VITE_API_URL` environment variable (public endpoint)
   - Purpose: Client-side interactions
   - Environment: Browser context

**Example Usage:**
```typescript
// In a route loader (SSR)
export async function loader() {
  const response = await fetch('http://api:9999/tasks');
  const tasks = await response.json();
  return { tasks };
}

// In a component (browser)
async function handleCreate() {
  await fetch(`${import.meta.env.VITE_API_URL}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ name: "New task" }),
  });
}
```

### Routing Structure

```typescript
// apps/web/app/routes.ts
export default [
  route("/", "routes/home.tsx"),
  route("/tasks", "routes/tasks.tsx"),
] satisfies RouteConfig;
```

Each route file can export:
- **loader**: Server-side data fetching
- **action**: Form submission handling
- **default**: React component

---

## Development Environments

### Option 1: Local Development (Recommended)

**Start API:**
```bash
cd apps/api
pnpm install
pnpm dev  # http://localhost:9999
```

**Start Web:**
```bash
cd apps/web
pnpm install
pnpm dev  # http://localhost:5173
```

**Characteristics:**
- ✅ Fast hot reload
- ✅ Easy debugging
- ✅ No Docker overhead
- ✅ Direct localhost communication
- ⚠️ Requires local Node.js and PostgreSQL

### Option 2: Docker Development

**Start All Services:**
```bash
docker-compose up --build
```

**Access:**
- Web: http://localhost:3000
- API: http://localhost:9999
- API Docs: http://localhost:9999/reference

**Characteristics:**
- ✅ Production-like environment
- ✅ No local dependencies needed
- ✅ Tests Docker networking
- ⚠️ Slower builds
- ⚠️ More complex debugging

### Environment Variables

**API Service:**
```bash
NODE_ENV=production
PORT=9999
LOG_LEVEL=info
DATABASE_URL=postgres://postgres:postgres@postgres:5432/api_db
```

**Web Service:**
```bash
# Server-side (SSR) - Docker internal
API_URL=http://api:9999

# Client-side (Browser) - Public URL
VITE_API_URL=http://localhost:9999  # dev
VITE_API_URL=https://api.yoursite.com  # prod
```

---

## Design Principles

### 1. Type Safety First

**Every layer is fully typed:**
- Database schema → TypeScript types
- Zod schemas → Request/response validation
- Route handlers → Type-safe implementations
- Frontend → Type-safe API requests

**Benefits:**
- Catch errors at compile time
- Excellent IDE autocomplete
- Refactoring confidence
- Self-documenting code

### 2. Single Source of Truth

**Database schema is the source:**
```
Drizzle Schema Definition
    ↓
drizzle-zod generates Zod schemas
    ↓
Zod schemas define API contracts
    ↓
OpenAPI spec auto-generated
    ↓
Types flow to all consumers
```

**Benefits:**
- No schema duplication
- Changes propagate automatically
- Consistency guaranteed

### 3. Separation of Concerns

**Clear boundaries between layers:**
- **Routes**: Define contracts (what)
- **Handlers**: Implement logic (how)
- **Database**: Data persistence
- **Middleware**: Cross-cutting concerns

**Benefits:**
- Easy to test
- Easy to understand
- Easy to modify

### 4. Never Frontend → Database

**Critical Rule:**
```
❌ WRONG: Browser/SSR → PostgreSQL
✅ CORRECT: Browser/SSR → API → PostgreSQL
```

**Always use the API layer:**
- Security: No direct DB credentials in frontend
- Validation: API validates all inputs
- Business logic: Centralized in API
- Type safety: API provides contracts

### 5. Documentation as Code

**API documentation is generated:**
- Routes define OpenAPI specs
- Zod schemas describe validation
- Scalar UI renders interactive docs
- Always in sync with code

**Benefits:**
- Never outdated
- Interactive testing
- Client SDK generation possible

---

## Related Documentation

### Getting Started
- **[QUICK_START.md](./QUICK_START.md)** - How to run the project locally or with Docker

### API Integration
- **[API_COMMUNICATION.md](./API_COMMUNICATION.md)** - Detailed guide on frontend-backend communication

### API Deep Dives
- **[apps/api/docs/01-overview.md](../apps/api/docs/01-overview.md)** - API philosophy and core concepts
- **[apps/api/docs/02-tech-stack.md](../apps/api/docs/02-tech-stack.md)** - Detailed technology explanations
- **[apps/api/docs/03-project-structure.md](../apps/api/docs/03-project-structure.md)** - API file organization

### Frontend Documentation
- **[apps/web/README.md](../apps/web/README.md)** - React Router frontend basics

---

## Summary

This architecture provides:

✅ **Full-Stack Type Safety**: From database to browser  
✅ **Modern Development Experience**: Fast feedback, hot reload, great tooling  
✅ **Production Ready**: Docker deployment, health checks, structured logging  
✅ **Scalable Patterns**: Works for small and large applications  
✅ **Self-Documenting**: OpenAPI spec + interactive documentation  
✅ **Maintainable**: Clear separation of concerns, consistent patterns  

The system is designed to be developer-friendly during development while being robust and performant in production.
