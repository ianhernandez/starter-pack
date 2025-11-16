# Development Workflow

This guide covers common development tasks and workflows when building with our stack.

## Initial Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your environment variables:

```env
NODE_ENV=development
PORT=9999
LOG_LEVEL=debug
DATABASE_URL=postgresql://user:password@localhost:5432/tasks_db
```

### 3. Set Up Database

```bash
# Push schema to database
pnpm drizzle-kit push

# Or generate and run migrations
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 4. Start Development Server

```bash
pnpm dev
```

Server starts at `http://localhost:9999` with hot reload enabled.

## Development Commands

### Core Commands

```bash
# Start development server with hot reload
pnpm dev

# Run type checking
pnpm typecheck

# Run linter
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Run tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Build for production
pnpm build

# Start production build
pnpm start
```

### Database Commands

```bash
# Open Drizzle Studio (GUI for database)
pnpm drizzle-kit studio

# Generate migration from schema changes
pnpm drizzle-kit generate

# Push schema directly to database (development)
pnpm drizzle-kit push

# Check what changes would be made
pnpm drizzle-kit check
```

## Adding a New Route

### Step 1: Define the Database Schema

Edit `src/db/schema.ts`:

```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const selectUsersSchema = createSelectSchema(users);
export const insertUsersSchema = createInsertSchema(users, {
  email: field => field.email(),
  name: field => field.min(1).max(100),
}).omit({ id: true, createdAt: true });
export const patchUsersSchema = insertUsersSchema.partial();
```

### Step 2: Push Schema to Database

```bash
pnpm drizzle-kit push
```

### Step 3: Create Route Structure

```bash
mkdir src/routes/users
touch src/routes/users/users.routes.ts
touch src/routes/users/users.handlers.ts
touch src/routes/users/users.index.ts
touch src/routes/users/users.test.ts
```

### Step 4: Define Route Contracts

Edit `src/routes/users/users.routes.ts`:

```typescript
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { selectUsersSchema } from "@/db/schema";

const tags = ["Users"];

export const list = createRoute({
  path: "/users",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectUsersSchema),
      "The list of users"
    ),
  },
});

export type ListRoute = typeof list;
```

### Step 5: Implement Handlers

Edit `src/routes/users/users.handlers.ts`:

```typescript
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import type { ListRoute } from "./users.routes";

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const users = await db.query.users.findMany();
  return c.json(users);
};
```

### Step 6: Wire Routes to Handlers

Edit `src/routes/users/users.index.ts`:

```typescript
import { createRouter } from "@/lib/create-app";
import * as handlers from "./users.handlers";
import * as routes from "./users.routes";

const router = createRouter()
  .openapi(routes.list, handlers.list);

export default router;
```

### Step 7: Register Router

Edit `src/app.ts`:

```typescript
import users from "@/routes/users/users.index";

const routes = [
  index,
  tasks,
  users, // Add new router
] as const;
```

### Step 8: Test the Endpoint

1. Start dev server: `pnpm dev`
2. Visit `http://localhost:9999/reference`
3. Test the `/users` endpoint

## Writing Tests

### Basic Test Structure

Create `src/routes/users/users.test.ts`:

```typescript
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";
import { createTestApp } from "@/lib/create-app";
import type { AppType } from "@/app";
import router from "./users.index";

describe("Users Routes", () => {
  const client = testClient<AppType>(createTestApp(router));

  it("lists users", async () => {
    const response = await client.users.$get();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
  });

  it("validates email on create", async () => {
    const response = await client.users.$post({
      json: {
        email: "invalid-email",
        name: "Test User",
      },
    });

    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.success).toBe(false);
  });
});
```

### Run Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run tests for specific file
pnpm test users.test
```

## Working with Drizzle Studio

Drizzle Studio provides a GUI for viewing and editing database data.

### Start Studio

```bash
pnpm drizzle-kit studio
```

Opens at `https://local.drizzle.studio`

### Features

- View all tables and data
- Add/edit/delete records
- View relationships
- Run queries

## Debugging

### Enable Debug Logs

Edit `.env`:

```env
LOG_LEVEL=debug
```

### Add Debug Logs in Code

```typescript
export const create: AppRouteHandler<CreateRoute> = async (c) => {
  c.var.logger.debug({ body: c.req.valid("json") }, "Creating task");
  
  const task = await db.insert(tasks).values(c.req.valid("json")).returning();
  
  c.var.logger.debug({ task }, "Task created");
  return c.json(task);
};
```

### View Logs

Logs appear in terminal with color coding:

- Blue: DEBUG
- Green: INFO
- Yellow: WARN
- Red: ERROR

## Common Issues & Solutions

### Issue: Port Already in Use

**Solution**: Change `PORT` in `.env` or kill the process using the port:

```bash
# Find process
lsof -i :9999

# Kill process
kill -9 [PID]
```

### Issue: Database Connection Failed

**Solution**: Verify `DATABASE_URL` in `.env` and ensure PostgreSQL is running:

```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql

# Start PostgreSQL (Linux)
sudo systemctl start postgresql
```

### Issue: TypeScript Errors After Schema Change

**Solution**: Restart TypeScript server in VSCode:

1. Cmd/Ctrl + Shift + P
2. "TypeScript: Restart TS Server"

### Issue: Tests Failing

**Solution**: Ensure test database is configured:

```bash
# Check .env.test exists
cat .env.test

# Verify DATABASE_URL points to test database
# Should be different from development database
```

## Code Style

### Imports Organization

Use the import alias `@/` for all internal imports:

```typescript
// Good
import { createRouter } from "@/lib/create-app";
import db from "@/db";

// Bad
import { createRouter } from "../../../lib/create-app";
import db from "../../db";
```

### Naming Conventions

- **Files**: kebab-case (`users.routes.ts`)
- **Types**: PascalCase (`ListRoute`, `AppBindings`)
- **Variables/Functions**: camelCase (`createRouter`, `tasksList`)
- **Constants**: UPPER_SNAKE_CASE (`HTTP_STATUS_CODES`)
- **Database Tables**: snake_case (`user_profiles`)

### File Organization

Each route module follows this structure:

```
feature/
  feature.routes.ts    # Contracts
  feature.handlers.ts  # Implementations
  feature.index.ts     # Router
  feature.test.ts      # Tests
```

## Git Workflow

### Branch Strategy

```bash
# Create feature branch
git checkout -b feature/add-users-endpoint

# Make changes and commit
git add .
git commit -m "feat: add users endpoint"

# Push branch
git push origin feature/add-users-endpoint
```

### Commit Message Format

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

Examples:

```
feat: add user authentication
fix: resolve database connection timeout
docs: update API documentation
refactor: extract validation helpers
test: add tests for task creation
chore: update dependencies
```

## Performance Tips

### 1. Use Database Indexes

Add indexes to frequently queried columns:

```typescript
export const users = pgTable("users", {
  email: text("email").notNull().unique(),
  // ...other columns
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
}));
```

### 2. Limit Query Results

Use pagination for large datasets:

```typescript
const tasks = await db.query.tasks.findMany({
  limit: 100,
  offset: page * 100,
});
```

### 3. Select Only Needed Columns

```typescript
const tasks = await db.select({
  id: tasks.id,
  name: tasks.name,
}).from(tasks);
```

### 4. Use Connection Pooling

Already configured in `src/db/index.ts` via Postgres.js.

## Deployment Preparation

### 1. Run Type Checks

```bash
pnpm typecheck
```

### 2. Run Linter

```bash
pnpm lint
```

### 3. Run Tests

```bash
pnpm test
```

### 4. Build Application

```bash
pnpm build
```

### 5. Test Production Build

```bash
NODE_ENV=production pnpm start
```

## Best Practices

### 1. Always Validate Input

Use Zod schemas for all request validation.

### 2. Document All Responses

Include all possible response codes in route definitions.

### 3. Use Proper Status Codes

- 200: Success
- 201: Created
- 204: No Content (delete)
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 422: Unprocessable Entity (validation)
- 500: Server Error

### 4. Write Tests

Test all happy paths and error cases.

### 5. Use Structured Logging

Log important events with context:

```typescript
c.var.logger.info({ userId, action: "login" }, "User logged in");
```

### 6. Handle Errors Gracefully

Always return meaningful error messages:

```typescript
if (!task) {
  return c.json(
    { message: HttpStatusPhrases.NOT_FOUND },
    HttpStatusCodes.NOT_FOUND
  );
}
```

## Summary

This workflow enables:

- **Fast Development**: Hot reload, type safety, auto-complete
- **Quality Assurance**: Linting, type checking, testing
- **Easy Debugging**: Structured logging, clear errors
- **Smooth Deployment**: Build validation, environment checks

Follow these patterns consistently for a productive development experience.
