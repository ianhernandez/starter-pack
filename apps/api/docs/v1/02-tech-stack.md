# Tech Stack Deep Dive

## Web Framework: Hono

### Why Hono?

**Hono** (meaning "flame" in Japanese) is a small, simple, and ultrafast web framework that works on any JavaScript runtime.

#### Key Benefits

1. **Ultrafast**: Optimized router with linear time complexity
2. **Lightweight**: Zero dependencies, small bundle size
3. **Runtime Agnostic**: Works on Node.js, Cloudflare Workers, Deno, Bun, etc.
4. **TypeScript First**: Excellent type inference and type safety
5. **Web Standards**: Built on Web Standards APIs (Request/Response)
6. **Middleware Ecosystem**: Rich middleware ecosystem

### Key Features We Use

- **Built-in request validation**: Via `c.req.valid()`
- **Type-safe routing**: Full TypeScript support for routes
- **Middleware composition**: Clean middleware pipeline
- **Test client**: Built-in testing utilities

## OpenAPI Integration: @hono/zod-openapi

### Why @hono/zod-openapi?

This middleware bridges Hono with OpenAPI specifications using Zod for validation.

#### Key Benefits

1. **Contract-First Design**: Define API contracts before implementation
2. **Automatic Documentation**: OpenAPI spec generated from Zod schemas
3. **Type Safety**: Route handlers are typed based on route definitions
4. **Validation**: Request/response validation using Zod
5. **Client Generation**: OpenAPI spec enables SDK generation

### How It Works

```typescript
// 1. Define route contract
export const list = createRoute({
  path: "/tasks",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectTasksSchema),
      "The list of tasks"
    ),
  },
});

// 2. Type flows to handler
export const listHandler: AppRouteHandler<typeof list> = async (c) => {
  // c.json() knows it must return an array of tasks
  return c.json(tasks);
};
```

## Schema Validation: Zod

### Why Zod?

Zod is a TypeScript-first schema validation library with static type inference.

#### Key Benefits

1. **TypeScript-First**: Schemas are types
2. **Zero Dependencies**: Lightweight
3. **Composable**: Build complex schemas from simple ones
4. **Great Error Messages**: Detailed validation errors
5. **Transform & Refine**: Advanced validation patterns

### Usage in Our Stack

```typescript
// Define schema
const taskSchema = z.object({
  name: z.string().min(1).max(500),
  done: z.boolean(),
});

// Get TypeScript type
type Task = z.infer<typeof taskSchema>;

// Validate data
const result = taskSchema.parse(data);
```

## Database: Drizzle ORM + PostgreSQL

### Why Drizzle ORM?

Drizzle is a lightweight, type-safe ORM with a SQL-like API.

#### Key Benefits

1. **Type Safety**: Full TypeScript inference
2. **SQL-Like**: Familiar syntax for SQL developers
3. **Lightweight**: No complex abstractions
4. **Excellent Migrations**: Schema diffing and migrations
5. **Great Performance**: Minimal overhead

### Why drizzle-zod?

**drizzle-zod** is the bridge that connects our database to our API validation.

```typescript
// 1. Define database table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  done: boolean("done").notNull().default(false),
});

// 2. Generate Zod schemas
export const selectTasksSchema = createSelectSchema(tasks);
export const insertTasksSchema = createInsertSchema(tasks, {
  name: field => field.min(1).max(500), // Add validation
}).omit({ id: true }); // Omit auto-generated fields
```

**Single Source of Truth**: The database schema is the source of truth, and all validation flows from it.

### Why PostgreSQL?

1. **Robust**: Battle-tested in production
2. **Feature-Rich**: Advanced data types, full-text search, JSON support
3. **ACID Compliant**: Data integrity guarantees
4. **Scalable**: Handles large datasets
5. **Extensible**: Rich ecosystem of extensions

## Logging: Pino + hono-pino

### Why Pino?

Pino is a fast, structured logger for Node.js.

#### Key Benefits

1. **Performance**: Extremely fast (benchmarked)
2. **Structured Logging**: JSON output for log aggregation tools
3. **Log Levels**: trace, debug, info, warn, error, fatal
4. **Pretty Printing**: Human-readable output in development
5. **Production Ready**: Used by major companies

### Our Implementation

```typescript
export function pinoLogger() {
  return logger({
    pino: pino({
      level: env.LOG_LEVEL || "info",
    }, env.NODE_ENV === "production" ? undefined : pretty()),
  });
}
```

**Development**: Pretty-printed, colorized logs
**Production**: JSON logs for aggregation tools (DataDog, LogDNA, etc.)

## Testing: Vitest

### Why Vitest?

Vitest is a blazing fast unit test framework powered by Vite.

#### Key Benefits

1. **Fast**: Parallel test execution, smart caching
2. **Vite Integration**: Uses Vite's transformation pipeline
3. **Jest Compatible**: Familiar API for Jest users
4. **TypeScript**: First-class TypeScript support
5. **Watch Mode**: Instant feedback during development

### Testing Utilities

We use Hono's built-in test client for type-safe API testing:

```typescript
const client = testClient<AppType>(createTestApp(router));
const response = await client.tasks.$get();
const json = await response.json();

expect(response.status).toBe(200);
expect(json).toHaveLength(3);
```

## API Documentation: Scalar

### Why Scalar?

Scalar provides beautiful, interactive API documentation from OpenAPI specs.

#### Key Benefits

1. **Beautiful UI**: Modern, clean interface
2. **Interactive**: Test endpoints directly in docs
3. **Multiple Themes**: Customizable appearance
4. **Code Examples**: Shows requests in multiple languages
5. **Free & Open Source**: Self-hosted

### Features We Use

- **Classic Layout**: Top-down documentation flow
- **Kepler Theme**: Dark, modern theme
- **Default Client**: JavaScript Fetch examples
- **Test Requests**: Interactive API testing

## Utility Library: Stoker

### Why Stoker?

Stoker is a custom utility library designed to reduce boilerplate when building Hono + OpenAPI applications.

#### What It Provides

1. **Middlewares**: Pre-configured error handlers, notFound, favicon
2. **OpenAPI Helpers**: `jsonContent()`, `jsonContentRequired()`, `jsonContentOneOf()`
3. **Status Code Constants**: Type-safe HTTP status codes
4. **Status Phrase Constants**: Canonical HTTP status phrases
5. **Common Schemas**: `IdParamsSchema`, `createErrorSchema()`, `createMessageObjectSchema()`
6. **Default Hook**: Standardized validation error responses

### Why We Use It

Instead of writing the same boilerplate in every project:

```typescript
// Without stoker
responses: {
  200: {
    content: {
      "application/json": {
        schema: mySchema,
      },
    },
    description: "Success",
  },
}

// With stoker
responses: {
  [HttpStatusCodes.OK]: jsonContent(mySchema, "Success"),
}
```

**Source Code**: The library is open source, and you can copy the code directly into your project if you prefer not to use the dependency.

## Environment Management

### dotenv + dotenv-expand

We use these packages for environment variable management:

- **dotenv**: Loads `.env` files
- **dotenv-expand**: Supports variable expansion (`${OTHER_VAR}`)
- **Zod Validation**: Type-safe environment variable validation

```typescript
const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum([...]),
  DATABASE_URL: z.string().url(),
});

const env = EnvSchema.parse(process.env);
```

If required environment variables are missing, the application won't start and will show clear error messages.

## Development Tools

### ESLint: @antfu/eslint-config

Anthony Fu's ESLint config provides opinionated, zero-config linting with:

- TypeScript support
- Auto-formatting on save
- Consistent code style
- Modern JavaScript features

### TypeScript

Full type safety across the entire application:

- Strict mode enabled
- Path aliases (`@/` for `src/`)
- Type inference from schemas
- Compile-time error catching

### tsx

Fast TypeScript execution and watching for development:

```json
{
  "dev": "tsx watch src/index.ts"
}
```

## Summary

Our tech stack is carefully chosen to provide:

1. **Maximum Type Safety**: From database to client
2. **Excellent DX**: Fast feedback, great tooling
3. **Production Ready**: Battle-tested technologies
4. **Maintainable**: Clear patterns, good documentation
5. **Scalable**: Patterns that work for small and large apps

Each technology solves a specific problem and integrates well with the others, creating a cohesive, enjoyable development experience.
