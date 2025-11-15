# PostgreSQL Migration Plan

## Overview
Migrating from SQLite/Turso to PostgreSQL for the Hono API

**Setup:**
- PostgreSQL 16 (via Docker)
- Development DB: `api_db`
- Test DB: `api_db_test`
- Both databases in single PostgreSQL container

---

## 1. Dependencies Changes

### Remove:
```json
"@libsql/client": "^0.15.10"
```

### Add:
```json
"postgres": "^3.4.4"
```

**Why `postgres`?** It's the recommended PostgreSQL driver for Drizzle ORM - lightweight, modern, and TypeScript-first.

---

## 2. Docker Compose PostgreSQL Service

Add to `docker-compose.yml`:

```yaml
postgres:
  image: postgres:16-alpine
  restart: always
  ports:
    - "5432:5432"
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: api_db
  volumes:
    - postgres-data:/var/lib/postgresql/data
    # Init script to create test database
    - ./apps/api/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
  networks:
    - dokploy-network
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5

volumes:
  postgres-data:
```

### Create Init Script
File: `apps/api/init-db.sh`
```bash
#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE api_db_test;
EOSQL
```

---

## 3. Environment Variables

### Development (`.env`)
```env
NODE_ENV=development
PORT=9999
LOG_LEVEL=debug
DATABASE_URL=postgres://postgres:postgres@localhost:5432/api_db
```

### Test (`.env.test`)
```env
NODE_ENV=test
PORT=9999
LOG_LEVEL=silent
DATABASE_URL=postgres://postgres:postgres@localhost:5432/api_db_test
```

### Production (`docker-compose.yml` or deployment)
```env
DATABASE_URL=postgres://postgres:postgres@postgres:5432/api_db
```

**Note:** Update API service in docker-compose.yml to depend on postgres:
```yaml
api:
  depends_on:
    postgres:
      condition: service_healthy
```

---

## 4. Drizzle Configuration

**File:** `apps/api/drizzle.config.ts`

```typescript
import { defineConfig } from "drizzle-kit";

import env from "@/env";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
```

**Changes:**

- `dialect: "turso"` → `dialect: "postgresql"`
- Remove `authToken` from `dbCredentials`

---

## 5. Database Schema

**File:** `apps/api/src/db/schema.ts`

```typescript
import { z } from "@hono/zod-openapi";
import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { toZodV4SchemaTyped } from "@/lib/zod-utils";

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const selectTasksSchema = toZodV4SchemaTyped(createSelectSchema(tasks));

export const insertTasksSchema = toZodV4SchemaTyped(createInsertSchema(
  tasks,
  {
    name: field => field.min(1).max(500),
  },
).required({
  done: true,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}));

// @ts-expect-error partial exists on zod v4 type
export const patchTasksSchema = insertTasksSchema.partial();
```

**Key Changes:**
- `sqliteTable` → `pgTable`
- `integer({ mode: "number" }).primaryKey({ autoIncrement: true })` → `serial("id").primaryKey()`
- `integer({ mode: "boolean" })` → `boolean("done")`
- `integer({ mode: "timestamp" })` → `timestamp("created_at", { mode: "date" })`
- `.$defaultFn(() => new Date())` → `.defaultNow()`

---

## 6. Database Connection

**File:** `apps/api/src/db/index.ts`

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import env from "@/env";

import * as schema from "./schema";

const client = postgres(env.DATABASE_URL);

const db = drizzle({
  client,
  casing: "snake_case",
  schema,
});

export default db;
```

**Changes:**
- `drizzle-orm/libsql` → `drizzle-orm/postgres-js`
- Import `postgres` driver
- Remove `authToken` configuration
- Create postgres client before passing to drizzle

---

## 7. Environment Configuration

**File:** `apps/api/src/env.ts`

```typescript
/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { z } from "zod";

expand(config({
  path: path.resolve(
    process.cwd(),
    process.env.NODE_ENV === "test" ? ".env.test" : ".env",
  ),
}));

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  DATABASE_URL: z.string().url(),
});

export type env = z.infer<typeof EnvSchema>;

// eslint-disable-next-line ts/no-redeclare
const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export default env!;
```

**Changes:**
- Remove `DATABASE_AUTH_TOKEN` from schema
- Remove `superRefine` validation for auth token

---

## 8. Update .gitignore

**File:** `apps/api/.gitignore`

Remove SQLite-specific entries:
```diff
- dev.db
- test.db
```

These are no longer needed with PostgreSQL.

---

## 9. Migration Steps (Execution Order)

### Step 1: Update Dependencies
```bash
cd apps/api
pnpm remove @libsql/client
pnpm add postgres@^3.4.4
```

### Step 2: Update Docker Compose
- Add PostgreSQL service to `docker-compose.yml`
- Create `apps/api/init-db.sh`
- Make init script executable: `chmod +x apps/api/init-db.sh`
- Add `postgres-data` volume
- Update API service to depend on PostgreSQL

### Step 3: Start PostgreSQL
```bash
docker-compose up -d postgres
```

### Step 4: Update Code Files
Update files in this order:
1. `apps/api/drizzle.config.ts`
2. `apps/api/src/db/schema.ts`
3. `apps/api/src/db/index.ts`
4. `apps/api/src/env.ts`
5. `apps/api/.env`
6. `apps/api/.env.example`
7. `apps/api/.env.test`
8. `apps/api/.gitignore`

### Step 5: Clean Old Migrations
```bash
cd apps/api
rm -rf src/db/migrations/*
rm -f dev.db test.db
```

### Step 6: Generate New Migrations
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### Step 7: Test
```bash
pnpm dev
# In another terminal
pnpm test
```

---

## 10. Data Type Mapping Reference

| SQLite (Current) | PostgreSQL (New) | Notes |
|-----------------|------------------|-------|
| `integer({ mode: "number" })` | `serial()` or `integer()` | Use `serial()` for auto-increment |
| `integer({ mode: "boolean" })` | `boolean()` | Native boolean type |
| `integer({ mode: "timestamp" })` | `timestamp()` | Native timestamp type |
| `text()` | `text()` | Same |
| `.primaryKey({ autoIncrement: true })` | `.primaryKey()` (on serial) | `serial()` auto-increments by default |
| `.$defaultFn(() => new Date())` | `.defaultNow()` | PostgreSQL native function |

---

## 11. Rollback Plan

If issues arise:

1. **Keep old code in git:**
   ```bash
   git stash  # or commit to branch
   ```

2. **Stop PostgreSQL:**
   ```bash
   docker-compose down postgres
   ```

3. **Restore old dependencies:**
   ```bash
   git checkout apps/api/package.json
   pnpm install
   ```

---

## 12. Testing Checklist

After migration:

- [ ] PostgreSQL container starts successfully
- [ ] Both databases (api_db and api_db_test) are created
- [ ] Development server connects to database
- [ ] Migrations run successfully
- [ ] API endpoints work (GET, POST, PATCH, DELETE)
- [ ] Tests pass with isolated test database
- [ ] Production build works
- [ ] Docker compose stack runs completely

---

## 13. Production Considerations

### Security:
- Change default PostgreSQL password in production
- Use environment-specific credentials
- Consider connection pooling for high traffic

### Performance:
- PostgreSQL is more powerful than SQLite for concurrent operations
- Consider adding indexes if needed
- Monitor connection pool usage

### Backup:
- Set up automated PostgreSQL backups
- Use `pg_dump` for exports:
  ```bash
  docker exec postgres pg_dump -U postgres api_db > backup.sql
  ```

---

## Expected Benefits

1. **Better Concurrency**: PostgreSQL handles multiple simultaneous connections
2. **Richer Data Types**: Native boolean, timestamp, JSON, etc.
3. **Advanced Features**: Full-text search, triggers, stored procedures
4. **Production-Ready**: Industry-standard RDBMS
5. **Better Tooling**: pgAdmin, DBeaver, and other PostgreSQL tools
6. **Ecosystem**: Better integration with ORMs and other tools

---

## Questions or Issues?

If you encounter any issues during migration:
1. Check PostgreSQL logs: `docker-compose logs postgres`
2. Verify connection string format
3. Ensure port 5432 is not already in use
4. Check that init script created test database

---

**Ready to proceed?** Review this plan, and when you're ready, we can start implementing the changes step-by-step!
