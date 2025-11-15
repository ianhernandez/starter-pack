# Dokploy Environment Configuration

## Overview

This document outlines the environment variables needed for deploying your application on Dokploy (or similar platforms like Coolify).

## Current Setup Issues

Your current `docker-compose.yml` has a **critical issue**:

```yaml
web:
  build:
    args:
      # ❌ This won't work in production - points to localhost
      - VITE_API_URL=${VITE_API_URL:-http://localhost:9999}
```

When the browser tries to call `http://localhost:9999`, it's looking for an API on the **user's local machine**, not your server.

## Required Environment Variables

### For Dokploy Master Environment

Add these to your Dokploy master environment (they'll be available to all services):

```bash
# ============================================
# DATABASE CONFIGURATION
# ============================================
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<SECURE_PASSWORD_HERE>  # ⚠️ Change this!
POSTGRES_DB=api_db

# Full connection string for API service
DATABASE_URL=postgres://postgres:<SECURE_PASSWORD_HERE>@postgres:5432/api_db

# ============================================
# API CONFIGURATION
# ============================================
NODE_ENV=production
PORT=9999
LOG_LEVEL=info  # Options: debug, info, warn, error

# ============================================
# WEB/FRONTEND CONFIGURATION
# ============================================
# Browser-accessible API URL (see solutions below)
VITE_API_URL=https://api.notarypublicupland.com  # Or your chosen solution

# Server-side API URL (internal Docker network)
API_URL=http://api:9999
```

## API URL Solutions

You have **three options** for exposing your API to browsers:

### Option 1: Subdomain (Recommended) ⭐

**Setup:**
1. Add API subdomain: `api.notarypublicupland.com`
2. Configure DNS to point to your server
3. Add Traefik labels to API service

**Update `docker-compose.yml`:**

```yaml
api:
  # ... existing config
  ports:
    - 9999  # Let Traefik handle external access
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.api-app.rule=Host(`api.notarypublicupland.com`)"
    - "traefik.http.routers.api-app.entrypoints=websecure"
    - "traefik.http.routers.api-app.tls.certResolver=letsencrypt"
    - "traefik.http.services.api-app.loadbalancer.server.port=9999"
    # CORS headers if needed
    - "traefik.http.middlewares.api-cors.headers.accessControlAllowOriginList=https://notarypublicupland.com"
    - "traefik.http.middlewares.api-cors.headers.accessControlAllowHeaders=*"
    - "traefik.http.middlewares.api-cors.headers.accessControlAllowMethods=GET,POST,PUT,PATCH,DELETE,OPTIONS"
    - "traefik.http.routers.api-app.middlewares=api-cors"
```

**Dokploy Environment:**
```bash
VITE_API_URL=https://api.notarypublicupland.com
```

**Pros:**
- ✅ Clean separation
- ✅ Standard practice
- ✅ Easy CORS management
- ✅ Can scale independently

**Cons:**
- ⚠️ Requires DNS configuration
- ⚠️ Another SSL cert (usually automatic with Let's Encrypt)

---

### Option 2: Path-Based Routing

**Setup:**
1. Use same domain with `/api` prefix
2. Configure Traefik path-based routing

**Update `docker-compose.yml`:**

```yaml
api:
  # ... existing config
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.api-app.rule=Host(`notarypublicupland.com`) && PathPrefix(`/api`)"
    - "traefik.http.routers.api-app.entrypoints=websecure"
    - "traefik.http.routers.api-app.tls.certResolver=letsencrypt"
    - "traefik.http.services.api-app.loadbalancer.server.port=9999"
    # Strip /api prefix before forwarding to service
    - "traefik.http.middlewares.api-stripprefix.stripprefix.prefixes=/api"
    - "traefik.http.routers.api-app.middlewares=api-stripprefix"

web:
  # ... existing config
  labels:
    - "traefik.enable=true"
    # Catch all non-API routes
    - "traefik.http.routers.web-app.rule=Host(`notarypublicupland.com`)"
    - "traefik.http.routers.web-app.entrypoints=websecure"
    - "traefik.http.routers.web-app.tls.certResolver=letsencrypt"
    - "traefik.http.services.web-app.loadbalancer.server.port=3000"
    # Lower priority than API routes
    - "traefik.http.routers.web-app.priority=1"
    - "traefik.http.routers.api-app.priority=2"
```

**Dokploy Environment:**
```bash
VITE_API_URL=https://notarypublicupland.com/api
```

**Pros:**
- ✅ Single domain
- ✅ No additional DNS
- ✅ Automatic CORS (same origin)

**Cons:**
- ⚠️ More complex routing
- ⚠️ Path prefix handling needed
- ⚠️ Harder to scale separately

---

### Option 3: Different Port (Not Recommended)

**Setup:**
1. Expose API on different port (e.g., 9999)
2. Users access via `notarypublicupland.com:9999`

**Dokploy Environment:**
```bash
VITE_API_URL=https://notarypublicupland.com:9999
```

**Pros:**
- ✅ Simple configuration

**Cons:**
- ❌ Non-standard (users don't like ports in URLs)
- ❌ May be blocked by firewalls
- ❌ Looks unprofessional
- ❌ CORS complexity

---

## Recommended Configuration

### For Production (Option 1 - Subdomain)

**Dokploy Master Environment Variables:**

```bash
# Database
POSTGRES_USER=apiuser
POSTGRES_PASSWORD=<GENERATE_STRONG_PASSWORD>
POSTGRES_DB=api_db
DATABASE_URL=postgres://apiuser:<STRONG_PASSWORD>@postgres:5432/api_db

# API
NODE_ENV=production
PORT=9999
LOG_LEVEL=info

# Web/Frontend
VITE_API_URL=https://api.notarypublicupland.com
API_URL=http://api:9999
```

**DNS Configuration:**
1. Add A record: `api.notarypublicupland.com` → Your server IP
2. Or CNAME: `api.notarypublicupland.com` → `notarypublicupland.com`

**Updated `docker-compose.yml` API section:**

```yaml
api:
  build:
    context: ./apps/api
    dockerfile: Dockerfile
  restart: always
  ports:
    - 9999  # Internal only, Traefik handles external
  environment:
    - NODE_ENV=production
    - PORT=9999
    - LOG_LEVEL=${LOG_LEVEL:-info}
    - DATABASE_URL=${DATABASE_URL}
  networks:
    - dokploy-network
  depends_on:
    postgres:
      condition: service_healthy
  healthcheck:
    test:
      [
        "CMD",
        "node",
        "-e",
        "require('http').get('http://localhost:9999/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})",
      ]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.api-app.rule=Host(`api.notarypublicupland.com`)"
    - "traefik.http.routers.api-app.entrypoints=websecure"
    - "traefik.http.routers.api-app.tls.certResolver=letsencrypt"
    - "traefik.http.services.api-app.loadbalancer.server.port=9999"
    # CORS middleware
    - "traefik.http.middlewares.api-cors.headers.accessControlAllowOriginList=https://notarypublicupland.com"
    - "traefik.http.middlewares.api-cors.headers.accessControlAllowHeaders=*"
    - "traefik.http.middlewares.api-cors.headers.accessControlAllowMethods=GET,POST,PUT,PATCH,DELETE,OPTIONS"
    - "traefik.http.middlewares.api-cors.headers.accessControlAllowCredentials=true"
    - "traefik.http.routers.api-app.middlewares=api-cors"
```

**Updated `docker-compose.yml` Web section:**

```yaml
web:
  build:
    context: ./apps/web
    dockerfile: Dockerfile
    args:
      # Browser-accessible API URL
      - VITE_API_URL=${VITE_API_URL:-https://api.notarypublicupland.com}
  restart: always
  ports:
    - 3000
  environment:
    # Server-side SSR uses Docker network hostname
    - API_URL=http://api:9999
  networks:
    - dokploy-network
  depends_on:
    - api
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.web-app.rule=Host(`notarypublicupland.com`)"
    - "traefik.http.routers.web-app.entrypoints=websecure"
    - "traefik.http.routers.web-app.tls.certResolver=letsencrypt"
    - "traefik.http.services.web-app.loadbalancer.server.port=3000"
```

## Security Best Practices

### 1. Strong Database Password

```bash
# Generate a strong password
openssl rand -base64 32

# Use in DATABASE_URL
DATABASE_URL=postgres://apiuser:YourGeneratedPasswordHere@postgres:5432/api_db
```

### 2. Separate Database User

Instead of using `postgres` superuser, create a dedicated user:

**Update `init-db.sh`:**
```bash
#!/bin/bash
set -e

# Create test database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE api_db_test;
EOSQL

# Create dedicated API user
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE USER apiuser WITH PASSWORD '$API_USER_PASSWORD';
    GRANT ALL PRIVILEGES ON DATABASE api_db TO apiuser;
    GRANT ALL PRIVILEGES ON DATABASE api_db_test TO apiuser;
EOSQL
```

**Add to Dokploy env:**
```bash
API_USER_PASSWORD=<ANOTHER_STRONG_PASSWORD>
```

### 3. Additional Security Variables

```bash
# JWT secret for authentication (if you add auth later)
JWT_SECRET=<GENERATE_RANDOM_STRING>

# Session secret (if using sessions)
SESSION_SECRET=<GENERATE_RANDOM_STRING>

# CORS allowed origins (comma-separated)
CORS_ORIGINS=https://notarypublicupland.com

# Rate limiting
RATE_LIMIT_MAX=100  # requests per window
RATE_LIMIT_WINDOW=900000  # 15 minutes in ms
```

## Environment Variable Checklist

Before deploying to Dokploy:

- [ ] ✅ Set `POSTGRES_PASSWORD` to strong password
- [ ] ✅ Update `DATABASE_URL` with production credentials
- [ ] ✅ Set `VITE_API_URL` to production API domain
- [ ] ✅ Configure DNS for API subdomain (if using Option 1)
- [ ] ✅ Update Traefik labels in docker-compose.yml
- [ ] ✅ Set `NODE_ENV=production`
- [ ] ✅ Set appropriate `LOG_LEVEL`
- [ ] ✅ Generate and set security secrets (JWT, session, etc.)
- [ ] ✅ Configure CORS origins
- [ ] ✅ Test API accessibility from browser
- [ ] ✅ Test SSR API calls from server
- [ ] ✅ Verify SSL certificates are working

## Testing Your Configuration

### 1. Test API Accessibility

```bash
# Should return API response (not CORS error)
curl https://api.notarypublicupland.com/

# From browser console (should work without CORS error)
fetch('https://api.notarypublicupland.com/')
  .then(r => r.json())
  .then(console.log)
```

### 2. Test Web App

```bash
# Should serve your React Router app
curl https://notarypublicupland.com/

# Check network tab in browser DevTools
# Look for API calls to correct domain
```

### 3. Test SSR API Calls

```bash
# Check server logs for successful API calls
docker logs <web-container-id>

# Should see successful API requests to http://api:9999
```

## Troubleshooting

### Issue: CORS Errors

**Symptom:** Browser console shows CORS errors

**Solution:** Add/update CORS middleware in Traefik labels:

```yaml
- "traefik.http.middlewares.api-cors.headers.accessControlAllowOriginList=https://notarypublicupland.com"
```

### Issue: 502 Bad Gateway on API

**Symptom:** API returns 502 error

**Solutions:**
1. Check API service is healthy: `docker ps`
2. Check API logs: `docker logs <api-container-id>`
3. Verify DATABASE_URL is correct
4. Check database is accessible from API service

### Issue: Client-side API calls fail

**Symptom:** Browser can't reach API

**Solutions:**
1. Verify `VITE_API_URL` is set correctly in build
2. Check DNS is resolving correctly: `nslookup api.notarypublicupland.com`
3. Verify Traefik labels are correct
4. Check SSL certificate: `curl -I https://api.notarypublicupland.com`

### Issue: SSR API calls fail

**Symptom:** Server-side rendering shows errors

**Solutions:**
1. Verify `API_URL=http://api:9999` in web service environment
2. Check services are on same Docker network
3. Verify API service name is "api" in docker-compose.yml
4. Test from web container: `docker exec <web-container> curl http://api:9999`

## Migration Checklist

Moving from local development to Dokploy:

1. **Update docker-compose.yml**
   - [ ] Add Traefik labels to API service
   - [ ] Update VITE_API_URL default value
   - [ ] Update web service labels with correct domain

2. **Configure Dokploy**
   - [ ] Add all environment variables to master config
   - [ ] Set strong passwords
   - [ ] Configure DNS records

3. **Deploy**
   - [ ] Push code to repository
   - [ ] Deploy via Dokploy
   - [ ] Monitor logs for errors
   - [ ] Test all functionality

4. **Verify**
   - [ ] API accessible via subdomain
   - [ ] Web app loads correctly
   - [ ] API calls work from browser
   - [ ] SSR works correctly
   - [ ] Database migrations ran successfully
   - [ ] Health checks passing

## Resources

- [Dokploy Documentation](https://dokploy.com/docs)
- [Traefik Docker Labels](https://doc.traefik.io/traefik/routing/providers/docker/)
- [Docker Compose Environment Variables](https://docs.docker.com/compose/environment-variables/)
- [Let's Encrypt with Traefik](https://doc.traefik.io/traefik/https/acme/)
