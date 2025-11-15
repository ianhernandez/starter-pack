# Key Patterns & Design Decisions

This document explains the core patterns and architectural decisions that make our API stack robust, maintainable, and type-safe.

## 1. Contract-First API Design

### The Pattern

Routes are defined as OpenAPI contracts **before** implementation. The contract specifies exactly what the API accepts and returns.

### Why This Approach?

1. **Documentation First**: API is documented before code is written
2. **Type Safety**: Implementation must match the contract
3. **Client Generation**: Contracts enable automatic client SDK generation
4. **Clear Communication**: Contracts serve as source of truth for frontend/backend communication

### Implementation

```typescript
// Step 1: Define the contract
export const create = createRoute({
  path: "/tasks",
  method: "post",
  request: {
    body: jsonContentRequired(insertTasksSchema, "The task to create"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTasksSchema, "The created task"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertTasksSchema),
      "The validation error(s)"
    ),
  },
});

// Step 2: Export the type
export type CreateRoute = typeof create;

// Step 3: Implement with type safety
export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const task = c.req.valid("json"); // Fully typed
  const [inserted] = await db.insert(tasks).values(task).returning();
  return c.json(inserted, HttpStatusCodes.OK); // Must match contract
};
```

### Benefits

- If handler returns wrong type → TypeScript error
- If handler doesn't handle documented status code → TypeScript error
- API docs stay in sync with implementation automatically

## 2. Single Source of Truth

### The Pattern

Database schema is the single source of truth. All types and validations derive from it.

### Type Flow

```
PostgreSQL Table (Drizzle)
         ↓
    Zod Schemas (drizzle-zod)
         ↓
    Route Definitions (OpenAPI)
         ↓
    Handler Types
         ↓
    OpenAPI Specification
         ↓
    Client SDKs
```

### Implementation

```typescript
// 1. Define database table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

// 2. Generate Zod schemas
export const selectTasksSchema = createSelectSchema(tasks);
export const insertTasksSchema = createInsertSchema(tasks, {
  name: field => field.min(1).max(500), // Add custom validation
}).omit({ id: true, createdAt: true, updatedAt: true });

// 3. Use in route definitions
export const create = createRoute({
  request: {
    body: jsonContentRequired(insertTasksSchema, "The task to create"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTasksSchema, "The created task"),
  },
});
```

### Benefits

1. **No Duplication**: Define table structure once
2. **Automatic Sync**: Change DB schema → types update everywhere
3. **Consistent Validation**: Same rules in DB, API, and docs
4. **Type Safety**: Full type inference from DB to client

## 3. Separation of Routes and Handlers

### The Pattern

Route definitions (contracts) live in `*.routes.ts`, implementations in `*.handlers.ts`.

### Why Separate?

1. **Clarity**: Easy to see API design without implementation details
2. **Review**: Can review API contracts independently
3. **Reusability**: Multiple handlers could implement same contract
4. **Organization**: Scales better as API grows
5. **Type Safety**: Handlers must implement route contracts

### File Organization

```
routes/
  tasks/
    tasks.index.ts    # Wires routes to handlers
    tasks.routes.ts   # Contract definitions
    tasks.handlers.ts # Implementations
    tasks.test.ts     # Tests
```

### Pattern Example

```typescript
// tasks.routes.ts - The contract
export const list = createRoute({
  path: "/tasks",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectTasksSchema), "The list of tasks"),
  },
});
export type ListRoute = typeof list;

// tasks.handlers.ts - The implementation
export const list: AppRouteHandler<ListRoute> = async (c) => {
  const tasks = await db.query.tasks.findMany();
  return c.json(tasks);
};

// tasks.index.ts - The connection
const router = createRouter()
  .openapi(routes.list, handlers.list);
```

## 4. Type-Safe Environment Variables

### The Pattern

Environment variables are validated at startup and accessed through a type-safe interface.

### Why This Approach?

1. **Fail Fast**: App won't start with missing/invalid env vars
2. **Clear Errors**: Shows exactly what's missing
3. **Type Safety**: No `string | undefined` everywhere
4. **Single Location**: One place to manage all env vars
5. **Documentation**: Schema documents required env vars

### Implementation

```typescript
// env.ts
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

// Usage elsewhere
import env from "@/env";
const port = env.PORT; // Type: number, guaranteed to exist
```

### No `process.env` Rule

We enforce a lint rule that prevents `process.env` usage anywhere except `env.ts`. This ensures:

- All env access is type-safe
- All env vars are documented in one place
- Missing env vars are caught immediately

## 5. Consistent Error Responses

### The Pattern

All validation errors respond with a consistent structure using Zod error format.

### Implementation

```typescript
// In create-app.ts
export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    defaultHook, // From stoker
  });
}

// Default hook (from stoker)
const defaultHook: Hook<any, any, any, any> = (result, c) => {
  if (!result.success) {
    return c.json(
      {
        success: false,
        error: result.error,
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "code": "invalid_type",
        "expected": "string",
        "received": "undefined",
        "path": ["name"],
        "message": "Required"
      }
    ],
    "name": "ZodError"
  }
}
```

### Benefits

1. **Consistency**: Every validation error has same structure
2. **Client-Friendly**: Easy to parse and display errors
3. **Detailed**: Shows exactly what's wrong and where
4. **Type-Safe**: Error structure is typed

## 6. Status Code Constants

### The Pattern

Use named constants instead of magic numbers for HTTP status codes.

### Implementation

```typescript
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";

// Instead of:
return c.json(task, 200);
return c.json({ message: "Not Found" }, 404);

// We write:
return c.json(task, HttpStatusCodes.OK);
return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
```

### Why?

1. **Readability**: `HttpStatusCodes.NOT_FOUND` is clearer than `404`
2. **Type Safety**: Constants work with Hono's type system
3. **Autocomplete**: IDE suggests available status codes
4. **Consistency**: Same constants used everywhere
5. **No Magic Numbers**: Code is self-documenting

## 7. Structured Logging

### The Pattern

Use Pino for structured, JSON logging with different levels.

### Configuration

```typescript
export function pinoLogger() {
  return logger({
    pino: pino({
      level: env.LOG_LEVEL || "info",
    }, env.NODE_ENV === "production" ? undefined : pretty()),
  });
}
```

### Usage in Handlers

```typescript
export const create: AppRouteHandler<CreateRoute> = async (c) => {
  c.var.logger.info({ taskId: task.id }, "Task created");
  c.var.logger.debug({ taskData: task }, "Debug task data");
  return c.json(task);
};
```

### Log Levels

- **fatal**: App is crashing
- **error**: Errors that need attention
- **warn**: Warnings, potential issues
- **info**: General information (default)
- **debug**: Detailed debugging information
- **trace**: Very detailed tracing
- **silent**: No logs (for tests)

### Environment-Specific Behavior

**Development:**
- Pretty-printed, colorized logs
- Human-readable format
- Debug level enabled

**Production:**
- JSON structured logs
- Ingested by log aggregation tools
- Info level (configurable)

## 8. Runtime Agnostic Design

### The Pattern

Core app is separated from runtime-specific serving logic.

### Implementation

```typescript
// app.ts - Runtime agnostic
import createApp from "@/lib/create-app";
const app = createApp();
export default app;

// index.ts - Node.js specific
import { serve } from "@hono/node-server";
import app from "./app";
serve({ fetch: app.fetch, port: 9999 });

// Future: cf-worker.ts - Cloudflare specific
import app from "./app";
export default app; // Cloudflare Workers use default export
```

### Benefits

1. **Portability**: Easy to deploy to different runtimes
2. **Testing**: App can be tested without runtime
3. **Flexibility**: Can run on Node, Deno, Bun, Cloudflare, etc.

## 9. Test Utilities

### The Pattern

Provide helpers that make testing routes easy and type-safe.

### Implementation

```typescript
// create-app.ts
export function createTestApp<S extends Schema>(router: AppOpenAPI<S>) {
  return createApp().route("/", router);
}

// tasks.test.ts
import { createTestApp } from "@/lib/create-app";
import router from "./tasks.index";

const testClient = testClient<AppType>(createTestApp(router));

it("lists tasks", async () => {
  const response = await testClient.tasks.$get();
  const json = await response.json();
  
  expect(response.status).toBe(200);
  expect(Array.isArray(json)).toBe(true);
});
```

### Benefits

1. **Type Safety**: Full type inference in tests
2. **Isolated**: Each route can be tested independently
3. **Realistic**: Tests run through full middleware stack
4. **Fast**: In-memory, no network calls

## 10. Helper Reduction with Stoker

### The Pattern

Use Stoker library to reduce common boilerplate patterns.

### Common Patterns

#### Without Stoker

```typescript
responses: {
  200: {
    content: {
      "application/json": {
        schema: mySchema,
      },
    },
    description: "Success",
  },
  404: {
    content: {
      "application/json": {
        schema: z.object({ message: z.string() }),
      },
    },
    description: "Not found",
  },
}
```

#### With Stoker

```typescript
responses: {
  [HttpStatusCodes.OK]: jsonContent(mySchema, "Success"),
  [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Not found"),
}
```

### Stoker Utilities We Use

1. **Helpers**: `jsonContent()`, `jsonContentRequired()`, `jsonContentOneOf()`
2. **Schemas**: `IdParamsSchema`, `createErrorSchema()`, `createMessageObjectSchema()`
3. **Middlewares**: `notFound`, `onError`, `serveEmojiFavicon`
4. **Constants**: Status codes, status phrases
5. **Hooks**: `defaultHook` for validation errors

### Why Stoker?

- Reduces 70% of OpenAPI boilerplate
- Maintains full type safety
- Open source, can copy code directly
- Designed specifically for Hono + OpenAPI

## Summary

These patterns work together to create a robust, maintainable API:

1. **Contract-first** ensures API is well-designed
2. **Single source of truth** eliminates duplication
3. **Separation of concerns** improves organization
4. **Type safety** catches errors early
5. **Consistent errors** improve client experience
6. **Structured logging** aids debugging
7. **Runtime agnostic** provides deployment flexibility
8. **Test utilities** encourage comprehensive testing
9. **Helper libraries** reduce boilerplate

Each pattern solves a specific problem while working harmoniously with the others.
