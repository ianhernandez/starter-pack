# Quick Start Guide

## 🚀 Two Ways to Run the Project

### Option 1: Local Development (Recommended)

**Best for:** Active development, fast hot-reload, debugging

```bash
# Terminal 1: Start the Hono API
cd apps/api
pnpm install  # first time only
pnpm dev      # runs on http://localhost:9999

# Terminal 2: Start the React Router frontend
cd apps/web
pnpm install  # first time only
pnpm dev      # runs on http://localhost:5173
```

**Access:**
- Frontend: http://localhost:5173
- API: http://localhost:9999
- API Docs: http://localhost:9999/reference

**How it works:**
- Both services run directly on your machine
- No Docker needed
- Fast hot-reload
- [`api.server.ts`](app/lib/api.server.ts:1) automatically uses `localhost:9999`

---

### Option 2: Docker (Production-like)

**Best for:** Testing production build, deployment simulation

```bash
# From project root
docker-compose up --build
```

**Access:**
- Frontend: http://localhost:3000
- API: http://localhost:9999
- API Docs: http://localhost:9999/reference

**How it works:**
- Services run in Docker containers
- Uses Docker network for inter-service communication
- [`api.server.ts`](app/lib/api.server.ts:1) uses `API_URL=http://api:9999` (Docker hostname)
- Slower builds, but matches production

---

## 📝 Try the Example

1. Start both services (use either option above)

2. Make sure your API is running and has the database:
   ```bash
   # Check if API is accessible
   curl http://localhost:9999
   
   # Should return: {"message":"Tasks API"}
   ```

3. Visit the tasks example:
   - http://localhost:5173/tasks (local dev)
   - http://localhost:3000/tasks (Docker)

4. You should see a task management interface that:
   - Lists all tasks
   - Creates new tasks
   - Toggles task completion
   - Deletes tasks

## 🔧 Troubleshooting

### "Failed to load tasks: fetch failed"

**Problem:** Frontend can't connect to the API

**Solution:** Make sure the API is running:
```bash
# Check if API is up
curl http://localhost:9999

# If not, start it:
cd apps/api
pnpm dev
```

### "Cannot find module './+types/tasks'"

**Problem:** TypeScript type generation hasn't run yet

**Solution:** This is normal on first run. The types generate automatically when you run `pnpm dev`.

### Docker: "api:9999 Connection refused"

**Problem:** Trying to use Docker hostname in local development

**Solution:** 
- If running locally with `pnpm dev`: Uses `localhost:9999` automatically ✅
- If running in Docker: Set `API_URL=http://api:9999` in docker-compose.yml ✅

## 🎯 Next Steps

1. **Read the architecture docs:** [`API_COMMUNICATION.md`](API_COMMUNICATION.md:1)
2. **Explore the example:** Check out [`apps/web/app/routes/tasks.tsx`](app/routes/tasks.tsx:1)
3. **Create your own routes:** Use the task example as a template
4. **Never connect to PostgreSQL directly:** Always use the API layer

## 💡 Pro Tips

### Local Development
- ✅ Use for daily development
- ✅ Fast hot-reload
- ✅ Easy debugging
- ✅ No Docker overhead

### Docker
- ✅ Use before deploying
- ✅ Test production builds
- ✅ Verify environment configs
- ✅ Debug container issues

### Best Practice
Start with local development, then test in Docker before deploying!
