# Stack Overview

## Introduction

This is a fully type-safe, OpenAPI-compliant REST API built with Hono, a lightweight web framework designed for modern JavaScript runtimes. The stack emphasizes developer experience through comprehensive type safety, automatic API documentation, and a clean separation of concerns.

## Core Philosophy

### 1. **Type Safety First**
Every layer of the application is fully typed - from database schemas to API responses to client SDKs. Changes to the database schema automatically propagate through the entire type system.

### 2. **Contract-First API Design**
Routes are defined as contracts (specifications) separate from their implementations. This separation enables:
- Better organization and maintainability
- Automatic OpenAPI documentation generation
- Type-safe request handlers
- Client SDK generation

### 3. **Single Source of Truth**
The database schema serves as the single source of truth. Using `drizzle-zod`, we derive Zod schemas from database tables, which then flow into route definitions, ensuring consistency across the entire stack.

### 4. **Developer Experience**
The stack prioritizes developer productivity through:
- Automatic API documentation with interactive testing
- Hot reload during development
- Comprehensive error messages
- Structured logging
- Built-in testing utilities

## Key Technologies

| Technology | Purpose | Why We Chose It |
|------------|---------|-----------------|
| **Hono** | Web Framework | Lightweight, fast, runtime-agnostic, excellent TypeScript support |
| **@hono/zod-openapi** | OpenAPI Integration | Seamless Zod + OpenAPI specification generation |
| **Zod** | Schema Validation | Best-in-class TypeScript-first validation with great DX |
| **Drizzle ORM** | Database ORM | Type-safe, lightweight, SQL-like syntax, excellent migrations |
| **drizzle-zod** | Schema Bridge | Converts Drizzle schemas to Zod schemas automatically |
| **PostgreSQL** | Database | Robust, feature-rich, production-proven |
| **Pino** | Logging | High-performance structured logging |
| **Vitest** | Testing | Fast, modern test runner with great DX |
| **Scalar** | API Documentation | Beautiful, interactive API documentation UI |
| **Stoker** | Hono Utilities | Reduces boilerplate for common Hono + OpenAPI patterns |

## Architecture Highlights

### Runtime Agnostic
The core application (`app.ts`) is completely runtime-agnostic. It can be deployed to:
- Node.js
- Cloudflare Workers
- Vercel Edge Functions
- Deno
- Bun

The entry point (`index.ts`) handles runtime-specific serving logic.

### Middleware Pipeline
```
Request → Request ID → Emoji Favicon → Pino Logger → Route Handler → Response
                                                    ↓
                                            Error Handler / Not Found
```

### Type Flow
```
Database Schema (Drizzle)
    ↓
Zod Schemas (drizzle-zod)
    ↓
Route Definitions (OpenAPI Contracts)
    ↓
Request Handlers (Type-Safe Implementation)
    ↓
OpenAPI Specification
    ↓
Interactive Documentation + Client SDKs
```

## Project Goals

1. **Maintainability**: Clean architecture with clear separation of concerns
2. **Type Safety**: Catch errors at compile time, not runtime
3. **Documentation**: API is self-documenting through OpenAPI
4. **Testability**: Easy to test with built-in testing utilities
5. **Scalability**: Patterns that scale from small to large applications
6. **Developer Joy**: Tools and patterns that make development enjoyable

## Next Steps

- [Tech Stack Details](./02-tech-stack.md)
- [Project Structure](./03-project-structure.md)
- [Getting Started](./04-getting-started.md)
