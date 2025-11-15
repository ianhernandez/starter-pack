# API Stack Documentation v1

Comprehensive documentation for our Hono + OpenAPI + Drizzle ORM stack.

## Quick Links

- **Live API Documentation**: `http://localhost:9999/reference` (when running)
- **OpenAPI Spec**: `http://localhost:9999/doc`
- **Repository**: Check the main README for repo links

## Documentation Index

### Getting Started

1. **[Overview](./01-overview.md)** - Start here
   - Stack philosophy and goals
   - Key technologies overview
   - Architecture highlights
   - Why we chose this stack

2. **[Tech Stack Deep Dive](./02-tech-stack.md)**
   - Detailed explanation of each technology
   - How components work together
   - Why each technology was chosen
   - Library-specific features we use

3. **[Project Structure](./03-project-structure.md)**
   - Directory organization
   - File naming conventions
   - Core files explained
   - How everything connects

### Core Concepts

4. **[Key Patterns & Design Decisions](./04-key-patterns.md)**
   - Contract-first API design
   - Single source of truth pattern
   - Type safety throughout
   - Error handling strategy
   - Logging approach
   - Helper library usage

### Practical Guides

5. **[Development Workflow](./05-development-workflow.md)**
   - Setting up your environment
   - Adding new routes
   - Writing tests
   - Debugging techniques
   - Common issues and solutions
   - Git workflow

6. **[Best Practices](./06-best-practices.md)**
   - Route design principles
   - Database best practices
   - Security considerations
   - Performance optimization
   - Testing strategies
   - Documentation standards

## Quick Start

### Prerequisites

- Node.js 18+ (or Bun/Deno)
- PostgreSQL 14+
- pnpm (or npm/yarn)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your database URL
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Push schema to database
pnpm drizzle-kit push

# Start development server
pnpm dev
```

Visit `http://localhost:9999/reference` to see your API documentation.

## Key Concepts

### 1. Type Flow

```
PostgreSQL Table (Drizzle)
         ↓
Zod Schemas (drizzle-zod)
         ↓
Route Definitions (OpenAPI)
         ↓
Handler Types
         ↓
Documentation & Client SDKs
```

Everything is typed from database to client.

### 2. File Organization

Each feature follows this pattern:

```
routes/feature/
  feature.routes.ts    # OpenAPI contracts
  feature.handlers.ts  # Implementations
  feature.index.ts     # Router setup
  feature.test.ts      # Tests
```

### 3. Development Cycle

```
1. Define database schema (schema.ts)
2. Generate Zod schemas (drizzle-zod)
3. Define route contracts (*.routes.ts)
4. Implement handlers (*.handlers.ts)
5. Wire together (*.index.ts)
6. Test (*.test.ts)
7. Deploy
```

## Architecture Decisions

### Why Hono?

- **Lightweight**: Small bundle, fast startup
- **Runtime Agnostic**: Deploy anywhere
- **Type-Safe**: Excellent TypeScript support
- **Modern**: Built on Web Standards

### Why OpenAPI?

- **Documentation**: Auto-generated, always in sync
- **Client SDKs**: Generate for any language
- **Standards**: Industry standard for REST APIs
- **Tooling**: Rich ecosystem of tools

### Why Drizzle ORM?

- **Type-Safe**: Full TypeScript inference
- **Lightweight**: No heavy abstractions
- **SQL-Like**: Familiar syntax
- **Great Migrations**: Schema diffing and migrations

### Why drizzle-zod?

- **Single Source of Truth**: Database → Validation
- **No Duplication**: Define once, use everywhere
- **Type Safety**: End-to-end types
- **Automatic Sync**: Schema changes flow through

### Why Separate Routes and Handlers?

- **Clarity**: See API design without implementation
- **Review**: Can review contracts independently
- **Type Safety**: Handlers must match contracts
- **Scalability**: Patterns work at any size

## Common Tasks

### Add a New Endpoint

```bash
# 1. Add to schema if needed
# Edit src/db/schema.ts

# 2. Create route files
mkdir src/routes/feature
touch src/routes/feature/feature.{routes,handlers,index,test}.ts

# 3. Define contract in feature.routes.ts
# 4. Implement in feature.handlers.ts
# 5. Wire in feature.index.ts
# 6. Register in src/app.ts
# 7. Test in feature.test.ts
```

See [Development Workflow](./05-development-workflow.md) for details.

### Run Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test -- --watch

# Specific file
pnpm test tasks.test
```

### View Database

```bash
# Start Drizzle Studio
pnpm drizzle-kit studio

# Opens at https://local.drizzle.studio
```

### Generate Migration

```bash
# After changing schema
pnpm drizzle-kit generate

# Apply migration
pnpm drizzle-kit migrate
```

## API Documentation

### Accessing Docs

When the server is running:

- **Interactive Docs**: `http://localhost:9999/reference`
- **OpenAPI JSON**: `http://localhost:9999/doc`

### Features

- Test endpoints directly in browser
- View all request/response schemas
- See validation requirements
- Copy code examples (JavaScript, Python, cURL, etc.)
- Search and filter endpoints

### Customization

Edit `src/lib/configure-open-api.ts` to:

- Change theme (`kepler`, `default`, `alternate`, `moon`, `purple`, `solarized`)
- Change layout (`classic`, `modern`)
- Change default code examples
- Customize branding

## Deployment

### Environment Variables

Required in production:

```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
DATABASE_URL=postgresql://user:password@host:5432/db
```

### Build

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Test
pnpm test

# Build
pnpm build

# Start
NODE_ENV=production pnpm start
```

### Runtime Portability

Core app (`app.ts`) is runtime-agnostic:

- **Node.js**: Use `@hono/node-server` (current setup)
- **Cloudflare Workers**: Export `app` as default
- **Vercel**: Use `@hono/vercel` adapter
- **Deno**: Import and serve directly
- **Bun**: Use `Bun.serve()`

## Troubleshooting

### Common Issues

**Port in Use**
```bash
# Change PORT in .env
PORT=3001
```

**Database Connection Failed**
```bash
# Verify PostgreSQL is running
pg_isready

# Check DATABASE_URL in .env
```

**TypeScript Errors**
```bash
# Restart TS server in VSCode
Cmd+Shift+P → "TypeScript: Restart TS Server"
```

**Tests Failing**
```bash
# Ensure .env.test exists with test database
cat .env.test
```

See [Development Workflow](./05-development-workflow.md#common-issues--solutions) for more.

## Learning Resources

### Video Tutorial

This documentation is based on a comprehensive video tutorial covering:

- Setting up the stack from scratch
- OpenAPI integration
- Type-safe development
- Testing strategies
- Best practices

### External Resources

- [Hono Documentation](https://hono.dev)
- [Zod Documentation](https://zod.dev)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Scalar Documentation](https://github.com/scalar/scalar)

## Contributing

### Code Style

- Use path aliases: `@/` for `src/`
- Follow naming conventions (see [Project Structure](./03-project-structure.md))
- Run `pnpm lint:fix` before committing
- Write tests for new features
- Update documentation when changing APIs

### Commit Messages

Follow conventional commits:

```
feat: add user authentication
fix: resolve database connection timeout
docs: update API documentation
refactor: extract validation helpers
test: add tests for task creation
```

## Project Goals

1. **Type Safety**: Catch errors at compile time
2. **Maintainability**: Clear patterns, easy to understand
3. **Documentation**: Self-documenting through OpenAPI
4. **Testability**: Easy to test with built-in utilities
5. **Scalability**: Patterns that work at any scale
6. **Developer Joy**: Pleasant development experience

## Stack Summary

| Aspect | Technology | Purpose |
|--------|-----------|----------|
| Framework | Hono | Lightweight, fast web framework |
| API Spec | OpenAPI 3.0 | Standard REST API documentation |
| Validation | Zod | Type-safe schema validation |
| Database | PostgreSQL | Production-ready database |
| ORM | Drizzle | Type-safe database queries |
| Schema Bridge | drizzle-zod | DB schema → Zod validation |
| Docs UI | Scalar | Interactive API documentation |
| Logging | Pino | Structured, fast logging |
| Testing | Vitest | Modern, fast test runner |
| Utilities | Stoker | Reduces OpenAPI boilerplate |

## Next Steps

1. Read [Overview](./01-overview.md) for high-level understanding
2. Follow [Development Workflow](./05-development-workflow.md) to add your first endpoint
3. Review [Best Practices](./06-best-practices.md) for guidance
4. Check [Key Patterns](./04-key-patterns.md) for architectural decisions

## Support

For questions or issues:

1. Check this documentation
2. Review code examples in `src/routes/tasks/`
3. Consult external library documentation
4. Check the video tutorial

## License

See LICENSE file in repository root.

---

**Last Updated**: 2024
**Documentation Version**: 1.0
