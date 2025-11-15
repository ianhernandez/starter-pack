# Testing Guide

This guide covers how to write tests for the API following our established patterns, best practices, and conventions.

## Table of Contents

- [Testing Stack](#testing-stack)
- [Project Setup](#project-setup)
- [Writing Tests](#writing-tests)
  - [Basic Test Structure](#basic-test-structure)
  - [Test Client Setup](#test-client-setup)
  - [Database Management](#database-management)
  - [Testing CRUD Operations](#testing-crud-operations)
- [Testing Patterns](#testing-patterns)
  - [Validation Testing](#validation-testing)
  - [Error Response Testing](#error-response-testing)
  - [Type Safety Testing](#type-safety-testing)
  - [Sequential Testing](#sequential-testing)
- [Best Practices](#best-practices)
- [Common Pitfalls](#common-pitfalls)
- [Examples](#examples)

## Testing Stack

Our testing infrastructure is built on:

- **[Vitest](https://vitest.dev/)** - Fast unit testing framework
- **[Hono Testing](https://hono.dev/docs/guides/testing)** - Type-safe test client for Hono apps
- **[Zod](https://zod.dev/)** - Schema validation and error handling
- **[Drizzle ORM](https://orm.drizzle.team/)** - Database operations in tests
- **[@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)** - OpenAPI + Zod integration

## Project Setup

### Environment Configuration

Tests must run in the `test` environment. Always include this check at the top of your test files:

```ts
import env from "@/env";

if (env.NODE_ENV !== "test") {
  throw new Error("NODE_ENV must be 'test'");
}
```

### Test File Location

Place test files alongside the routes they test:

```
src/routes/
  tasks/
    tasks.index.ts
    tasks.routes.ts
    tasks.handlers.ts
    tasks.test.ts  ← Test file here
```

## Writing Tests

### Basic Test Structure

Every test file follows this pattern:

```ts
import { testClient } from "hono/testing";
import { execSync } from "node:child_process";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import db from "@/db";
import { yourTable } from "@/db/schema";
import env from "@/env";
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from "@/lib/constants";
import { createTestApp } from "@/lib/create-app";

import router from "./your-route.index";

// Environment check
if (env.NODE_ENV !== "test") {
  throw new Error("NODE_ENV must be 'test'");
}

// Create test client
const client = testClient(createTestApp(router));

describe("your routes", () => {
  beforeAll(async () => {
    execSync("pnpm drizzle-kit push");
    await db.delete(yourTable);
  });

  afterAll(async () => {
    await db.delete(yourTable);
  });

  // Your tests here
});
```

### Test Client Setup

The test client provides type-safe access to your routes:

```ts
const client = testClient(createTestApp(router));

// Type-safe route access
const response = await client.tasks.$post({
  json: { name: "Test task", done: false }
});

// Path parameters
const response = await client.tasks[":id"].$get({
  param: { id: 1 }
});
```

**Benefits:**

- Full TypeScript type inference
- Autocomplete for routes and parameters
- Compile-time route validation
- Type-safe request/response payloads

### Database Management

#### Setup and Teardown

Always clean up database state before and after tests:

```ts
beforeAll(async () => {
  // Push schema changes to test database
  execSync("pnpm drizzle-kit push");

  // Clean up any existing test data
  await db.delete(tasks);
});

afterAll(async () => {
  // Clean up test data after tests complete
  await db.delete(tasks);
});
```

#### Why This Matters

- Ensures tests start with a clean slate
- Prevents test pollution and flakiness
- Allows tests to run in any order
- Keeps test database clean

### Testing CRUD Operations

Test CRUD operations in a logical sequence, validating both success and error cases:

#### 1. CREATE - Validation First

Always test validation before successful creation:

```ts
it("post /tasks validates the body when creating", async () => {
  const response = await client.tasks.$post({
    json: {
      done: false,
      // Missing required 'name' field
    },
  });

  expect(response.status).toBe(422);
  if (response.status === 422) {
    const json = await response.json();
    expect(json.error.issues[0].path[0]).toBe("name");
    expect(json.error.issues[0].message).toBe(ZOD_ERROR_MESSAGES.EXPECTED_STRING);
  }
});

it("post /tasks creates a task", async () => {
  const response = await client.tasks.$post({
    json: {
      name: "Learn vitest",
      done: false,
    },
  });

  expect(response.status).toBe(200);
  if (response.status === 200) {
    const json = await response.json();
    expect(json.name).toBe("Learn vitest");
    expect(json.done).toBe(false);
    id = json.id; // Capture for later tests
  }
});
```

#### 2. READ - List and Single Item

```ts
it("get /tasks lists all tasks", async () => {
  const response = await client.tasks.$get({});

  expect(response.status).toBe(200);
  if (response.status === 200) {
    const json = await response.json();
    expectTypeOf(json).toBeArray();
    expect(json.length).toBe(1);
  }
});

it("get /tasks/{id} gets a single task", async () => {
  const response = await client.tasks[":id"].$get({
    param: { id },
  });

  expect(response.status).toBe(200);
  if (response.status === 200) {
    const json = await response.json();
    expect(json.name).toBe("Learn vitest");
    expect(json.done).toBe(false);
  }
});
```

#### 3. UPDATE - Validation and Partial Updates

```ts
it("patch /tasks/{id} validates the body when updating", async () => {
  const response = await client.tasks[":id"].$patch({
    param: { id },
    json: {
      name: "", // Invalid: empty string
    },
  });

  expect(response.status).toBe(422);
  if (response.status === 422) {
    const json = await response.json();
    expect(json.error.issues[0].path[0]).toBe("name");
    expect(json.error.issues[0].code).toBe(ZodIssueCode.too_small);
  }
});

it("patch /tasks/{id} updates a single property", async () => {
  const response = await client.tasks[":id"].$patch({
    param: { id },
    json: {
      done: true,
    },
  });

  expect(response.status).toBe(200);
  if (response.status === 200) {
    const json = await response.json();
    expect(json.done).toBe(true);
  }
});
```

#### 4. DELETE - Validation and Removal

```ts
it("delete /tasks/{id} validates the id when deleting", async () => {
  const response = await client.tasks[":id"].$delete({
    param: {
      id: "wat", // Invalid: not a number
    },
  });

  expect(response.status).toBe(422);
  if (response.status === 422) {
    const json = await response.json();
    expect(json.error.issues[0].path[0]).toBe("id");
    expect(json.error.issues[0].message).toBe(ZOD_ERROR_MESSAGES.EXPECTED_NUMBER);
  }
});

it("delete /tasks/{id} removes a task", async () => {
  const response = await client.tasks[":id"].$delete({
    param: { id },
  });

  expect(response.status).toBe(204);
});
```

## Testing Patterns

### Validation Testing

Always test validation for:

- Required fields
- Field types
- Field constraints (min/max length, format, etc.)
- Invalid parameter types

**Pattern:**

```ts
it("validates required fields", async () => {
  const response = await client.endpoint.$post({
    json: { /* missing required field */ },
  });

  expect(response.status).toBe(422);
  if (response.status === 422) {
    const json = await response.json();
    expect(json.error.issues[0].path[0]).toBe("fieldName");
    expect(json.error.issues[0].message).toBe(ZOD_ERROR_MESSAGES.EXPECTED_TYPE);
  }
});
```

### Error Response Testing

Test all error scenarios:

```ts
// 404 - Not Found
it("get /tasks/{id} returns 404 when task not found", async () => {
  const response = await client.tasks[":id"].$get({
    param: { id: 999 },
  });

  expect(response.status).toBe(404);
  if (response.status === 404) {
    const json = await response.json();
    expect(json.message).toBe(HttpStatusPhrases.NOT_FOUND);
  }
});

// 422 - Validation Error
it("validates empty body", async () => {
  const response = await client.tasks[":id"].$patch({
    param: { id },
    json: {},
  });

  expect(response.status).toBe(422);
  if (response.status === 422) {
    const json = await response.json();
    expect(json.error.issues[0].code).toBe(ZOD_ERROR_CODES.INVALID_UPDATES);
    expect(json.error.issues[0].message).toBe(ZOD_ERROR_MESSAGES.NO_UPDATES);
  }
});
```

### Type Safety Testing

Use `expectTypeOf` to validate response types:

```ts
it("returns correct types", async () => {
  const response = await client.tasks.$get({});

  if (response.status === 200) {
    const json = await response.json();

    // Validate it's an array
    expectTypeOf(json).toBeArray();

    // Validate array item structure
    expectTypeOf(json[0]).toMatchTypeOf<{
      id: number;
      name: string;
      done: boolean;
    }>();
  }
});
```

### Sequential Testing

Use shared state for tests that depend on each other:

```ts
let id: number;
const name = "Learn vitest";

it("creates a resource", async () => {
  const response = await client.resource.$post({ /* ... */ });
  if (response.status === 200) {
    const json = await response.json();
    id = json.id; // Capture for later tests
  }
});

it("updates the resource", async () => {
  const response = await client.resource[":id"].$patch({
    param: { id }, // Use captured ID
    json: { /* updates */ },
  });
  // ...
});

it("deletes the resource", async () => {
  const response = await client.resource[":id"].$delete({
    param: { id }, // Use captured ID
  });
  // ...
});
```

## Best Practices

### 1. **Test Validation Before Success**

Always write tests for validation errors before testing successful operations:

```ts
// ✅ Good: Validation test first
it("validates input", async () => { /* ... */ });
it("creates resource successfully", async () => { /* ... */ });

// ❌ Bad: Success test first
it("creates resource successfully", async () => { /* ... */ });
it("validates input", async () => { /* ... */ });
```

### 2. **Use Type Guards for Status Codes**

Type guard the response status to get proper TypeScript inference:

```ts
const response = await client.endpoint.$get({});

// ✅ Good: Type guard gives you proper types
if (response.status === 200) {
  const json = await response.json();
  // json is properly typed here
}

// ❌ Bad: No type narrowing
const json = await response.json();
// json type is unknown
```

### 3. **Test Both Success and Error Paths**

Every endpoint should have tests for:

- Happy path (successful operation)
- Validation errors (422)
- Not found errors (404)
- Authorization errors (401/403) if applicable

### 4. **Clean Up After Each Test Suite**

Always clean up in `afterAll`:

```ts
afterAll(async () => {
  await db.delete(yourTable);
});
```

### 5. **Use Descriptive Test Names**

Test names should clearly describe what they test:

```ts
// ✅ Good: Clear and specific
it("post /tasks validates the body when creating", async () => {});
it("get /tasks/{id} returns 404 when task not found", async () => {});
it("patch /tasks/{id} updates a single property of a task", async () => {});

// ❌ Bad: Vague and unclear
it("works", async () => {});
it("tests validation", async () => {});
it("updates task", async () => {});
```

### 6. **Test One Thing Per Test**

Each test should validate a single behavior:

```ts
// ✅ Good: One concern per test
it("validates required name field", async () => { /* ... */ });
it("validates name minimum length", async () => { /* ... */ });
it("validates done field type", async () => { /* ... */ });

// ❌ Bad: Testing multiple concerns
it("validates all fields", async () => {
  // Testing multiple validations in one test
});
```

### 7. **Use Constants for Error Messages**

Always reference error messages from constants:

```ts
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from "@/lib/constants";

// ✅ Good: Using constants
expect(json.error.issues[0].message).toBe(ZOD_ERROR_MESSAGES.EXPECTED_STRING);

// ❌ Bad: Hard-coded strings
expect(json.error.issues[0].message).toBe("Expected string, received number");
```

### 8. **Validate Error Structure**

Check both the error code and message:

```ts
if (response.status === 422) {
  const json = await response.json();
  expect(json.error.issues[0].path[0]).toBe("fieldName");
  expect(json.error.issues[0].code).toBe(ZodIssueCode.too_small);
  expect(json.error.issues[0].message).toBe(ZOD_ERROR_MESSAGES.TOO_SMALL);
}
```

## Common Pitfalls

### 1. **Not Running in Test Environment**

❌ **Problem:** Tests run against production database

```ts
// Missing environment check
const client = testClient(createTestApp(router));
```

✅ **Solution:** Always check environment first

```ts
if (env.NODE_ENV !== "test") {
  throw new Error("NODE_ENV must be 'test'");
}
```

### 2. **Not Cleaning Up Database**

❌ **Problem:** Tests fail due to existing data

```ts
describe("tests", () => {
  it("test 1", async () => { /* ... */ });
});
```

✅ **Solution:** Clean up before and after

```ts
describe("tests", () => {
  beforeAll(async () => {
    await db.delete(table);
  });

  afterAll(async () => {
    await db.delete(table);
  });
});
```

### 3. **Not Using Type Guards**

❌ **Problem:** TypeScript errors or type assertions

```ts
const json = await response.json();
expect(json.name).toBe("Test"); // Type error
```

✅ **Solution:** Use status code type guards

```ts
if (response.status === 200) {
  const json = await response.json();
  expect(json.name).toBe("Test"); // Properly typed
}
```

### 4. **Hard-Coding IDs**

❌ **Problem:** Tests break when data changes

```ts
it("gets task", async () => {
  const response = await client.tasks[":id"].$get({
    param: { id: 1 }, // Hard-coded ID
  });
});
```

✅ **Solution:** Capture IDs from creation

```ts
let id: number;

it("creates task", async () => {
  const response = await client.tasks.$post({ /* ... */ });
  if (response.status === 200) {
    const json = await response.json();
    id = json.id; // Capture ID
  }
});

it("gets task", async () => {
  const response = await client.tasks[":id"].$get({
    param: { id }, // Use captured ID
  });
});
```

## Examples

### Complete Test File Example

See [`tasks.test.ts`](../src/routes/tasks/tasks.test.ts) for a complete example demonstrating all patterns:

- Environment validation
- Test client setup
- Database setup/teardown
- Validation testing
- CRUD operation testing
- Error handling
- Type safety checks
- Sequential test dependencies

### Testing Custom Validation

```ts
it("validates custom business logic", async () => {
  const response = await client.endpoint.$post({
    json: {
      startDate: "2024-01-01",
      endDate: "2023-12-31", // Invalid: end before start
    },
  });

  expect(response.status).toBe(422);
  if (response.status === 422) {
    const json = await response.json();
    expect(json.error.issues[0].message).toBe(
      "End date must be after start date"
    );
  }
});
```

### Testing with Query Parameters

```ts
it("filters by query parameters", async () => {
  const response = await client.tasks.$get({
    query: {
      done: "true",
      limit: "10",
    },
  });

  expect(response.status).toBe(200);
  if (response.status === 200) {
    const json = await response.json();
    expect(json.every(task => task.done)).toBe(true);
    expect(json.length).toBeLessThanOrEqual(10);
  }
});
```

### Testing Authorization

```ts
it("requires authentication", async () => {
  const response = await client.protected.$get({
    // No auth headers
  });

  expect(response.status).toBe(401);
});

it("allows authenticated requests", async () => {
  const response = await client.protected.$get({
    headers: {
      Authorization: "Bearer valid-token",
    },
  });

  expect(response.status).toBe(200);
});
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test tasks.test.ts
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Hono Testing Guide](https://hono.dev/docs/guides/testing)
- [Stoker Documentation](./stoker.md)
- [Zod Documentation](https://zod.dev/)
- [Real-world Example](https://github.com/w3cj/hono-open-api-starter/blob/main/src/routes/tasks/tasks.test.ts)
