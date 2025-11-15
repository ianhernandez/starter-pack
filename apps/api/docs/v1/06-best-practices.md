# Best Practices & Decision Guide

This document explains the best practices we follow and why certain architectural decisions were made.

## Route Design

### 1. RESTful Endpoints

Follow REST principles for endpoint design:

```
GET    /tasks         - List all tasks
POST   /tasks         - Create a task
GET    /tasks/:id     - Get single task
PATCH  /tasks/:id     - Update task
DELETE /tasks/:id     - Delete task
```

**Why?**
- Predictable, industry-standard patterns
- Easy for clients to understand
- Works well with HTTP methods

### 2. Document All Response Codes

Always document all possible response codes:

```typescript
export const getOne = createRoute({
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectTasksSchema, "The requested task"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Task not found"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "Invalid id error"
    ),
  },
});
```

**Why?**
- Complete API documentation
- Clients know what to expect
- Better error handling on frontend

### 3. Use Specific HTTP Status Codes

Choose the most appropriate status code:

- **200 OK**: Successful GET, POST, PATCH
- **201 Created**: Resource created (rarely used, 200 is fine)
- **204 No Content**: Successful DELETE
- **400 Bad Request**: Generic client error
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Authentication valid but insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **422 Unprocessable Entity**: Validation errors
- **500 Internal Server Error**: Server errors

**Why?**
- Semantic meaning helps debugging
- Industry standard expectations
- Better error handling on clients

### 4. Validate Everything

Use Zod schemas for all inputs:

```typescript
export const create = createRoute({
  request: {
    body: jsonContentRequired(insertTasksSchema, "The task to create"),
  },
  // ...
});
```

**Why?**
- Prevents invalid data from entering system
- Type-safe throughout application
- Clear error messages for clients

### 5. Use Tags for Organization

Group related endpoints:

```typescript
const tags = ["Tasks"];

export const list = createRoute({
  tags,
  // ...
});
```

**Why?**
- Organized documentation
- Easy to navigate in Scalar UI
- Clear API structure

## Database Practices

### 1. Use Transactions for Multiple Operations

```typescript
await db.transaction(async (tx) => {
  await tx.insert(tasks).values(newTask);
  await tx.insert(auditLog).values(logEntry);
});
```

**Why?**
- Atomic operations
- Data consistency
- Rollback on errors

### 2. Add Indexes for Performance

```typescript
export const users = pgTable("users", {
  email: text("email").notNull().unique(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
}));
```

**Why?**
- Faster queries
- Better performance at scale
- Lower database load

### 3. Use Timestamps

Always include `createdAt` and `updatedAt`:

```typescript
createdAt: timestamp("created_at").defaultNow(),
updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
```

**Why?**
- Audit trail
- Debugging help
- Feature requirements (show "created 2 days ago")

### 4. Don't Expose Internal IDs in URLs (When Security Matters)

For sensitive resources, consider UUIDs instead of auto-incrementing integers:

```typescript
id: uuid("id").defaultRandom().primaryKey(),
```

**Why?**
- Harder to guess valid IDs
- No information leakage about volume
- Better for distributed systems

**When to use integers:**
- Internal tools
- Non-sensitive data
- When sequential IDs are beneficial

## Schema Design

### 1. Keep Schemas DRY

Generate schemas from database tables:

```typescript
export const selectTasksSchema = createSelectSchema(tasks);
export const insertTasksSchema = createInsertSchema(tasks);
```

**Why?**
- Single source of truth
- No duplication
- Automatic type sync

### 2. Add Custom Validation

Extend generated schemas with business rules:

```typescript
export const insertTasksSchema = createInsertSchema(tasks, {
  name: field => field.min(1).max(500),
  email: field => field.email(),
}).required({ done: true });
```

**Why?**
- Business logic in one place
- Consistent validation
- Clear constraints

### 3. Create Schema Variants

Define different schemas for different operations:

```typescript
export const selectTasksSchema = createSelectSchema(tasks);
export const insertTasksSchema = createInsertSchema(tasks).omit({ id: true });
export const patchTasksSchema = insertTasksSchema.partial();
```

**Why?**
- Appropriate validation for each operation
- Clear contracts
- Type safety

## Error Handling

### 1. Use Global Error Handler

Let the global error handler catch unhandled errors:

```typescript
app.onError(onError);
```

**Why?**
- Consistent error responses
- Catch unexpected errors
- Structured logging

### 2. Handle Expected Errors Explicitly

For expected errors, handle them explicitly:

```typescript
if (!task) {
  return c.json(
    { message: HttpStatusPhrases.NOT_FOUND },
    HttpStatusCodes.NOT_FOUND
  );
}
```

**Why?**
- Clear intent
- Proper status codes
- Better UX

### 3. Log Errors with Context

Include relevant context in error logs:

```typescript
c.var.logger.error({ taskId, userId, error }, "Failed to create task");
```

**Why?**
- Easier debugging
- Better monitoring
- Context for investigation

## Logging Practices

### 1. Use Appropriate Log Levels

```typescript
c.var.logger.debug({ data }, "Detailed debug info");
c.var.logger.info({ event }, "Significant event");
c.var.logger.warn({ issue }, "Potential problem");
c.var.logger.error({ error }, "Actual error");
```

**Why?**
- Filter logs by severity
- Reduce noise in production
- Find issues faster

### 2. Include Structured Data

```typescript
c.var.logger.info({ 
  userId: user.id,
  action: "task_created",
  taskId: task.id 
}, "Task created");
```

**Why?**
- Machine-readable
- Easy to query
- Better analytics

### 3. Don't Log Sensitive Data

Never log passwords, tokens, or PII:

```typescript
// Bad
c.var.logger.info({ password: user.password }, "User created");

// Good
c.var.logger.info({ userId: user.id }, "User created");
```

**Why?**
- Security compliance
- Privacy regulations (GDPR, etc.)
- Prevent data leaks

## Testing Practices

### 1. Test Happy Paths and Error Cases

```typescript
it("creates a task", async () => {
  const response = await client.tasks.$post({
    json: { name: "Test", done: false },
  });
  expect(response.status).toBe(200);
});

it("validates required fields", async () => {
  const response = await client.tasks.$post({
    json: { name: "" },
  });
  expect(response.status).toBe(422);
});
```

**Why?**
- Comprehensive coverage
- Catch edge cases
- Prevent regressions

### 2. Use Isolated Test Database

Always use separate test database:

```env
# .env.test
DATABASE_URL=postgresql://localhost/tasks_test
```

**Why?**
- Don't pollute dev data
- Repeatable tests
- Safe to reset

### 3. Clean Up After Tests

```typescript
afterEach(async () => {
  await db.delete(tasks);
});
```

**Why?**
- Test isolation
- Predictable results
- No test interdependence

## Security Practices

### 1. Validate All Input

Never trust client input:

```typescript
const task = c.req.valid("json"); // Already validated by Zod
```

**Why?**
- Prevent injection attacks
- Data integrity
- Type safety

### 2. Use Environment Variables for Secrets

Never hardcode secrets:

```typescript
// Bad
const API_KEY = "sk_live_123456";

// Good
const API_KEY = env.API_KEY;
```

**Why?**
- Security
- Different values per environment
- Easy rotation

### 3. Use HTTPS in Production

Always use HTTPS for production:

```typescript
if (env.NODE_ENV === "production" && !env.DATABASE_URL.startsWith("https")) {
  throw new Error("Database must use SSL in production");
}
```

**Why?**
- Encrypted communication
- Prevent man-in-the-middle attacks
- Industry standard

## Performance Practices

### 1. Use Pagination for Large Lists

```typescript
export const list = createRoute({
  request: {
    query: z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(100).default(20),
    }),
  },
  // ...
});
```

**Why?**
- Faster responses
- Lower memory usage
- Better UX

### 2. Use Database Indexes

Index columns used in WHERE, JOIN, ORDER BY:

```typescript
(table) => ({
  emailIdx: index("email_idx").on(table.email),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
})
```

**Why?**
- Faster queries
- Better scalability
- Lower costs

### 3. Select Only Needed Columns

```typescript
const tasks = await db.select({
  id: tasks.id,
  name: tasks.name,
}).from(tasks);
```

**Why?**
- Less data transfer
- Faster queries
- Lower memory usage

## Code Organization

### 1. Feature-Based Structure

Organize by feature, not by type:

```
routes/
  tasks/
    tasks.routes.ts
    tasks.handlers.ts
    tasks.index.ts
  users/
    users.routes.ts
    users.handlers.ts
    users.index.ts
```

**Why?**
- Related code together
- Easy to find
- Scales well

### 2. Extract Reusable Logic

Create utilities for common patterns:

```typescript
// lib/pagination.ts
export function paginate(query: any, page: number, limit: number) {
  return query.limit(limit).offset((page - 1) * limit);
}
```

**Why?**
- DRY principle
- Consistent behavior
- Easy to update

### 3. Use Path Aliases

Always use `@/` for imports:

```typescript
import db from "@/db";
import { createRouter } from "@/lib/create-app";
```

**Why?**
- No relative path hell
- Easy refactoring
- Cleaner code

## Documentation Practices

### 1. Keep Docs in Sync with Code

Update docs when changing code:

```typescript
// Update route definition when changing endpoint
export const list = createRoute({
  path: "/tasks",  // If path changes, update docs
  // ...
});
```

**Why?**
- Accurate documentation
- Trust in docs
- Better DX

### 2. Write Clear Descriptions

Be specific in descriptions:

```typescript
// Bad
"Get data"

// Good
"Returns a list of all tasks for the authenticated user"
```

**Why?**
- Clear expectations
- Better API docs
- Easier integration

### 3. Document Breaking Changes

Clearly mark breaking changes:

```typescript
/**
 * @deprecated Use getOne instead. Will be removed in v2.0.0
 */
export const getById = createRoute({
  // ...
});
```

**Why?**
- Smooth migrations
- Advance notice
- Version management

## When to Break These Rules

Rules are guidelines, not laws. Break them when:

1. **Performance critical path**: Optimize as needed
2. **Legacy integration**: Match existing patterns
3. **Third-party constraints**: Adapt to external requirements
4. **Team consensus**: Agree on better approach

Always document why you're breaking a rule:

```typescript
// NOTE: Using sequential IDs here instead of UUIDs because
// this is an internal admin tool and we need human-readable IDs
id: serial("id").primaryKey(),
```

## Summary

These practices ensure:

- **Maintainability**: Code is easy to understand and modify
- **Reliability**: Fewer bugs, better error handling
- **Performance**: Optimized for production use
- **Security**: Protected against common vulnerabilities
- **Scalability**: Patterns that work at any scale

Follow these consistently for a high-quality codebase.
