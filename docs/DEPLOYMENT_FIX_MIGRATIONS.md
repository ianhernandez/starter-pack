# 🚨 CRITICAL DEPLOYMENT FIX: Database Migrations

## ❌ Current Problem

Your API is crashing in production with this error:

```
ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "drizzle-kit" not found
```

**Why this happens:**
- Your [`docker-entrypoint.sh`](../apps/api/docker-entrypoint.sh) tries to run `pnpm drizzle-kit migrate`
- But `drizzle-kit` is in `devDependencies` in [`package.json`](../apps/api/package.json)
- Your [`Dockerfile`](../apps/api/Dockerfile) production stage only installs production dependencies
- So `drizzle-kit` command doesn't exist in the production container

**Result:**
- ❌ Migrations never run
- ❌ Database tables don't exist
- ❌ API returns 500 errors
- ❌ Frontend shows "API Error: 500 Internal Server Error"

---

## ✅ IMMEDIATE FIX (Recommended)

### Move drizzle-kit to Production Dependencies

**File:** `apps/api/package.json`

```diff
{
  "dependencies": {
    "@hono/node-server": "^1.19.6",
    "@hono/zod-openapi": "^1.1.4",
    "@scalar/hono-api-reference": "^0.9.24",
    "dotenv": "^17.2.1",
    "dotenv-expand": "^12.0.2",
    "drizzle-orm": "^0.44.7",
    "drizzle-zod": "^0.8.3",
+   "drizzle-kit": "^0.31.4",
    "hono": "^4.10.6",
    "hono-pino": "^0.10.3",
    "pino": "^10.1.0",
    "pino-pretty": "^13.1.2",
    "postgres": "^3.4.7",
    "stoker": "2.0.1",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@antfu/eslint-config": "^5.1.0",
    "@types/node": "^24.2.0",
    "cross-env": "^10.0.0",
-   "drizzle-kit": "^0.31.4",
    "eslint": "^9.32.0",
    "eslint-plugin-format": "^1.0.1",
    "tsc-alias": "^1.8.16",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vitest": "^3.2.1"
  }
}
```

**Why this works:**
- ✅ Production build will include `drizzle-kit`
- ✅ Migrations can run at container startup
- ✅ No code changes needed
- ✅ Simple and maintainable

**Trade-offs:**
- Slightly larger production image (~20-30MB)
- Still fast to deploy
- Common pattern for database tools

---

## 🎯 RECOMMENDED ACTION PLAN

**For Dokploy Deployment:**

### Step 1: Fix package.json (5 minutes)

```bash
cd apps/api
```

Edit `package.json` and move `drizzle-kit` from `devDependencies` to `dependencies`.

### Step 2: Rebuild and Redeploy

In Dokploy:
1. Trigger new build
2. Watch logs to confirm migrations run
3. Check API health

### Step 3: Verify

```bash
# API should respond with tasks array (even if empty)
curl https://your-domain.com/tasks
# Should return: []

# Frontend should load without errors
# Visit: https://your-domain.com/tasks
```

---

## 🔍 How to Debug in Future

### Check if migrations ran:

```bash
# Connect to database
docker exec -it <postgres-container> psql -U postgres -d api_db

# Check for tables
\dt

# Should see:
#  Schema |     Name      | Type  |  Owner
# --------+---------------+-------+----------
#  public | tasks         | table | postgres
#  public | drizzle_migrations | table | postgres
```

### Check API logs:

```bash
# Should see:
Running database migrations...
Starting application...
[INFO] Server listening on port 9999
```

### Check API is responding:

```bash
curl http://api:9999/tasks
# Should return JSON, not error
```

---

## 📊 Why This Happens

This is a common Docker multi-stage build gotcha:

```dockerfile
# Stage 1: Install ALL dependencies (includes drizzle-kit)
FROM node:22-alpine AS development-dependencies-env
RUN pnpm install --frozen-lockfile

# Stage 2: Install ONLY production dependencies (NO drizzle-kit)
FROM node:22-alpine AS production-dependencies-env
RUN pnpm install --frozen-lockfile --prod

# Final stage: Uses production dependencies
COPY --from=production-dependencies-env /app/node_modules ./node_modules
# ☝️ This doesn't include devDependencies!
```

**The `--prod` flag excludes devDependencies**, which makes the image smaller but breaks tools needed at runtime.

---

**TL;DR: Move `drizzle-kit` from `devDependencies` to `dependencies` in `apps/api/package.json` and rebuild. Done.** ✅
