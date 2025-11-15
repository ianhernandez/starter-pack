# Project Structure

## Directory Overview

```
apps/api/
├── src/
│   ├── app.ts                 # Main application setup
│   ├── index.ts               # Runtime-specific entry point
│   ├── env.ts                 # Type-safe environment variables
│   ├── db/
│   │   ├── index.ts          # Database connection
│   │   ├── schema.ts         # Database tables & Zod schemas
│   │   └── migrations/       # Database migrations
│   ├── lib/
│   │   ├── configure-open-api.ts  # OpenAPI docs configuration
│   │   ├── create-app.ts          # App factory functions
│   │   ├── types.ts               # Shared TypeScript types
│   │   ├── constants.ts           # Shared constants
│   │   └── zod-utils.ts          # Zod helper utilities
│   ├── middlewares/
│   │   └── pino-logger.ts    # Logging middleware configuration
│   └── routes/
│       ├── index.route.ts    # Root route
│       └── tasks/
│           ├── tasks.index.ts     # Task router
│           ├── tasks.routes.ts    # Route definitions (contracts)
│           ├── tasks.handlers.ts  # Route implementations
│           └── tasks.test.ts      # Route tests
├── .env                       # Environment variables (gitignored)
├── .env.example              # Example environment template
├── .env.test                 # Test environment variables
├── package.json              # Dependencies & scripts
├── tsconfig.json             # TypeScript configuration
├── drizzle.config.ts         # Drizzle ORM configuration
├── vitest.config.ts          # Vitest test configuration
└── eslint.config.mjs         # ESLint configuration
```

## Core Files

### `src/app.ts` - Application Entry Point

This is the runtime-agnostic application definition.

**Responsibilities:**
- Create the Hono app instance
- Configure OpenAPI documentation
- Register all route modules
- Export app type for RPC clients

```typescript
import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import index from "@/routes/index.route";
import tasks from "@/routes/tasks/tasks.index";

const app = createApp();
configureOpenAPI(app);

const routes = [index, tasks] as const;
routes.forEach((route) => app.route("/", route));

export type AppType = typeof routes[number];
export default app;
```

**Key Design Decisions:**

1. **Routes Array**: All routes are defined in an array for easy management
2. **Type Export**: `AppType` enables type-safe RPC clients
3. **`as const`**: Ensures TypeScript preserves literal types
4. **Separation**: Pure app logic, no runtime-specific code

### `src/index.ts` - Runtime Entry Point

Handles runtime-specific serving (Node.js in our case).

**Responsibilities:**
- Import the app
- Configure the HTTP server
- Start listening on specified port

```typescript
import { serve } from "@hono/node-server";
import app from "./app";
import env from "./env";

const port = env.PORT;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
```

**Why Separate?**

If deploying to Cloudflare Workers or Vercel, you'd create a different entry point (`cf-worker.ts` or `vercel.ts`) that imports the same `app`.

### `src/env.ts` - Type-Safe Environment

Validates and provides type-safe access to environment variables.

**Responsibilities:**
- Load `.env` file (or `.env.test` in test mode)
- Define Zod schema for environment variables
- Validate on startup
- Export type-safe env object

```typescript
const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  DATABASE_URL: z.string().url(),
});

export type env = z.infer<typeof EnvSchema>;

const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export default env!;
```

**Key Features:**

- App won't start with missing/invalid environment variables
- Clear error messages show exactly what's missing
- Type-safe access throughout the application
- No `process.env` usage elsewhere in codebase

## Database Layer

### `src/db/index.ts` - Database Connection

Establishes the database connection using Drizzle ORM.

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import env from "@/env";
import * as schema from "./schema";

const client = postgres(env.DATABASE_URL);
const db = drizzle(client, { schema });

export default db;
```

**Key Decisions:**

- Schema is passed to `drizzle()` for query builder type inference
- Connection is established once and exported
- Environment variable used for connection string

### `src/db/schema.ts` - Single Source of Truth

Defines database tables and generates Zod schemas.

```typescript
import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Generated Zod schemas
export const selectTasksSchema = createSelectSchema(tasks);
export const insertTasksSchema = createInsertSchema(tasks, {
  name: field => field.min(1).max(500),
}).required({ done: true }).omit({ id: true, createdAt: true, updatedAt: true });
export const patchTasksSchema = insertTasksSchema.partial();
```

**Schema Types:**

- **selectTasksSchema**: For data coming from DB (includes id, createdAt, etc.)
- **insertTasksSchema**: For creating new records (omits auto-generated fields)
- **patchTasksSchema**: For partial updates (all fields optional)

**Single Source of Truth Flow:**

```
Database Table Definition (tasks)
         ↓
Zod Schemas (selectTasksSchema, insertTasksSchema, patchTasksSchema)
         ↓
Route Definitions (request/response contracts)
         ↓
Request Handlers (implementation)
         ↓
TypeScript Types (inferred everywhere)
```

## Library Layer

### `src/lib/create-app.ts` - App Factory

Provides reusable functions for creating Hono instances.

**Exports:**

1. **`createRouter()`**: Creates a new OpenAPIHono instance
2. **`createApp()`** (default): Creates app with all middlewares
3. **`createTestApp()`**: Creates app for testing with mounted router

```typescript
export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook,
  });
}

export default function createApp() {
  const app = createRouter();
  app.use(requestId())
     .use(serveEmojiFavicon("📝"))
     .use(pinoLogger());
  
  app.notFound(notFound);
  app.onError(onError);
  return app;
}

export function createTestApp<S extends Schema>(router: AppOpenAPI<S>) {
  return createApp().route("/", router);
}
```

**Key Decisions:**

- **`strict: false`**: `/tasks` and `/tasks/` are treated as same route
- **`defaultHook`**: Validation errors respond with consistent Zod error format
- **Middleware order**: requestId → favicon → logger → routes
- **Test utility**: `createTestApp()` wraps routers for isolated testing

### `src/lib/configure-open-api.ts` - Documentation Setup

Configures OpenAPI documentation and Scalar UI.

```typescript
export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
      title: "Tasks API",
    },
  });

  app.get("/reference", Scalar({
    url: "/doc",
    theme: "kepler",
    layout: "classic",
    defaultHttpClient: {
      targetKey: "js",
      clientKey: "fetch",
    },
  }));
}
```

**Endpoints Created:**

- `GET /doc`: OpenAPI JSON specification
- `GET /reference`: Interactive Scalar documentation UI

**Key Decisions:**

- Version synced with `package.json`
- Kepler theme for modern dark appearance
- Classic layout for top-down documentation
- JavaScript Fetch as default code examples

### `src/lib/types.ts` - Shared Types

Central location for reusable TypeScript types.

```typescript
import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";

export interface AppBindings {
  Variables: {
    logger: PinoLogger;
  };
}

export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppBindings, S>;
export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
```

**Type Purposes:**

- **`AppBindings`**: Defines variables available in context (`c.var`)
- **`AppOpenAPI`**: Type for OpenAPIHono instances with our bindings
- **`AppRouteHandler`**: Type for route handlers with proper typing

### `src/lib/constants.ts` - Shared Constants

Reusable constants and schemas across the application.

```typescript
export const ZOD_ERROR_MESSAGES = {
  REQUIRED: "Required",
  NO_UPDATES: "No updates provided",
};

export const ZOD_ERROR_CODES = {
  INVALID_UPDATES: "invalid_updates",
};

export const notFoundSchema = createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND);
```

**Purpose:**

- Centralized error messages
- Reusable schemas (e.g., `notFoundSchema`)
- Consistency across routes

## Routes Layer

### Route Module Structure

Each feature/resource has its own folder with three files:

1. **`*.index.ts`**: Router that connects routes to handlers
2. **`*.routes.ts`**: Route definitions (OpenAPI contracts)
3. **`*.handlers.ts`**: Route implementations
4. **`*.test.ts`**: Route tests

### `tasks.routes.ts` - Route Definitions

Defines the API contract for each endpoint.

```typescript
export const list = createRoute({
  path: "/tasks",
  method: "get",
  tags: ["Tasks"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectTasksSchema),
      "The list of tasks"
    ),
  },
});

export type ListRoute = typeof list;
```

**What's Defined:**

- HTTP method
- URL path
- Request validation (params, query, body)
- Response specifications (status codes, schemas, descriptions)
- OpenAPI tags for grouping

**Why Separate File?**

- Contract is independent of implementation
- Easier to review API design
- Types can be imported by handlers
- Clear separation of concerns

### `tasks.handlers.ts` - Route Implementations

Implements the business logic for each route.

```typescript
export const list: AppRouteHandler<ListRoute> = async (c) => {
  const tasks = await db.query.tasks.findMany();
  return c.json(tasks);
};
```

**Key Features:**

- **Type Safety**: `AppRouteHandler<ListRoute>` ensures correct response type
- **Validated Input**: `c.req.valid()` provides validated, typed data
- **Database Access**: Uses Drizzle ORM for queries
- **Error Handling**: Global error handler catches unhandled errors

### `tasks.index.ts` - Router

Connects routes to handlers.

```typescript
import { createRouter } from "@/lib/create-app";
import * as handlers from "./tasks.handlers";
import * as routes from "./tasks.routes";

const router = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.create, handlers.create)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.patch, handlers.patch)
  .openapi(routes.remove, handlers.remove);

export default router;
```

**Why This Pattern?**

- Clean, declarative routing
- Type safety between route and handler
- Easy to see all endpoints at a glance
- Handlers and routes stay organized

## Configuration Files

### `tsconfig.json`

Key settings:

- **`"type": "module"`**: ESM modules
- **Path aliases**: `@/*` maps to `src/*`
- **Strict mode**: Maximum type safety

### `drizzle.config.ts`

Drizzle Kit configuration for migrations:

- Schema location: `src/db/schema.ts`
- Migrations folder: `src/db/migrations`
- Database driver configuration

### `vitest.config.ts`

Test configuration:

- Path aliases resolution
- Test environment setup
- Coverage configuration

## Design Principles

### 1. Separation of Concerns

Each file has a single, clear responsibility:

- Routes define contracts
- Handlers implement logic
- Index files wire things together

### 2. Type Flow

Types flow from database → schemas → routes → handlers:

```
Database Schema → Zod Schema → Route Definition → Handler Type
```

### 3. Reusability

Common functionality is extracted:

- `createRouter()`, `createApp()`, `createTestApp()`
- Shared types in `types.ts`
- Shared constants in `constants.ts`

### 4. Testability

- Test utilities provided (`createTestApp()`)
- Isolated route testing
- Type-safe test client

### 5. Scalability

Patterns that work for 5 routes or 500 routes:

- Feature-based organization
- Consistent file structure
- Minimal boilerplate

## Adding a New Resource

To add a new resource (e.g., "users"):

1. Create `src/routes/users/` folder
2. Add `users.routes.ts` (define contracts)
3. Add `users.handlers.ts` (implement logic)
4. Add `users.index.ts` (wire together)
5. Add to routes array in `src/app.ts`

The pattern scales linearly with your application's complexity.
