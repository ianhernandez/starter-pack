# 🚀 **Mega Architecture Guide: From Requirements → Domain → Schema → Services → Routes → Handlers**

This edition removes "Use Cases" entirely and consolidates all business logic into **Services**. Services now handle both simple and complex workflows.

---

# 💡 0. Philosophy: Your Stack's Architectural Vision

Your architecture flows cleanly:

```
User Story → Domain → Database (Drizzle)
→ Validation (drizzle-zod)
→ Services (all business logic)
→ Route Contracts
→ Handlers (Hono)
```

Handlers stay thin. Services contain **all domain logic**, including what previously lived in "use case" classes.

---

# 🧩 1. Requirements → Domain Analysis

Before coding, extract:

* Entities
* Relationships
* Business rules

```ts
Domain Entities:
- User
- Project
- Task

Relationships:
- User has many Projects
- Project has many Tasks

Business Rules:
- Project name 3–500 chars
- User must own project
- Tasks inherit permissions
```

This prepares the domain layer for service logic.

---

# 🗄️ 2. Domain → Database Schema

Define tables with Drizzle. Schemas become your source of truth.

```ts
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["active", "archived"] }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});
```

### Generate Zod schemas directly from Drizzle

```ts
export const insertProjectsSchema = createInsertSchema(projects, {
  name: (field) => field.min(3).max(500),
}).omit({ id: true, createdAt: true, updatedAt: true });
```

---

# 🧠 3. Services: Your Single Home for All Business Logic

All rules, permissions, workflows, and multi-step processes now live inside **Services**.

Handlers simply call these.

### Example: Project Service

```ts
export class ProjectService {
  async createProject(userId: number, data: ProjectInput) {
    const [project] = await db.insert(projects)
      .values({ ...data, userId })
      .returning();
    return project;
  }

  async updateProject(id: number, userId: number, data: ProjectInputPartial) {
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, userId)),
    });

    if (!project) throw new Error("Not found");

    const [updated] = await db.update(projects)
      .set(data)
      .where(eq(projects.id, id))
      .returning();

    return updated;
  }

  async archiveProject(id: number, userId: number) {
    return await db.transaction(async (tx) => {
      const project = await tx.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
        with: { tasks: true },
      });

      if (!project) throw new Error("Not found");

      const openTasks = project.tasks.filter(t => !["done", "cancelled"].includes(t.status));
      if (openTasks.length > 0) {
        throw new Error("Project has incomplete tasks");
      }

      const [archived] = await tx.update(projects)
        .set({ status: "archived" })
        .where(eq(projects.id, id))
        .returning();

      return archived;
    });
  }
}
```

### What Services Handle

* Validation beyond basic shape
* Permissions
* Database operations
* Transactions
* Multi-step logic

### What Services Do *Not* Handle

* HTTP response formatting
* JSON parsing
* Route-level schema validation

---

# 🛡️ 4. Authorization Middleware

Attach user identity + shared context.

```ts
export async function requireAuth(c, next) {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ message: "Unauthorized" }, 401);

  c.set("userId", Number(userId));
  await next();
}
```

---

# 📡 5. Route Contracts (OpenAPI)

Define endpoints in a contract-first manner.

```ts
export const archive = createRoute({
  path: "/projects/:id/archive",
  method: "post",
  tags: ["Projects"],
  middleware: [requireAuth],
  request: {
    params: IdParamsSchema,
  },
  responses: {
    200: jsonContent(selectProjectsSchema, "Archived project"),
    404: jsonContent(notFoundSchema, "Not found"),
    400: jsonContent(createMessageObjectSchema("Cannot archive project")),
  },
});
```

---

# ⚙️ 6. Handlers (Thin, Declarative, Zero Logic)

Handlers now:

1. Retrieve validated input
2. Access context (e.g., userId)
3. Call a service method
4. Map errors → HTTP results

```ts
export const archive: AppRouteHandler<typeof routes.archive> = async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.valid("param");

  try {
    const project = await projectService.archiveProject(id, userId);
    return c.json(project, 200);
  } catch (err) {
    if (err.message.includes("incomplete")) {
      return c.json({ message: err.message }, 400);
    }
    return c.json({ message: "Not found" }, 404);
  }
};
```

---

# 🧪 7. Testing Strategy

Test three layers:

### **1. Services**

* Test business rules
* Test transactions
* Test permission logic

### **2. Handlers**

* Test response shaping
* Test mapping of service errors

---

# 🔧 8. Decision Matrix (Updated)

| Scenario             | Place                 |
| -------------------- | --------------------- |
| Simple CRUD          | Service               |
| CRUD with rules      | Service               |
| Multi-step workflows | Service (transaction) |
| Cross-cutting logic  | Middleware            |
| Validation           | drizzle-zod           |

No more use cases. All logic = Services.

---

# 🪜 9. Standard Feature Development Workflow

### Step-by-step:

1. Extract requirements
2. Define domain rules
3. Update DB schema
4. Build *only* services (simple or transactional)
5. Write route contracts
6. Write handlers
7. Write tests
8. Register routes

---

# 🌐 10. Example End-to-End Feature: Task Collaboration

### Now using Services only.

**Service:**

```ts
class TaskCollaboratorService {
  async addCollaborator(taskId, ownerId, collaboratorId) {
    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.userId, ownerId)),
    });

    if (!task) throw new Error("Not found");

    const exists = await db.query.taskCollaborators.findFirst({
      where: and(
        eq(taskCollaborators.taskId, taskId),
        eq(taskCollaborators.userId, collaboratorId)
      ),
    });

    if (exists) throw new Error("Already collaborator");

    return db.insert(taskCollaborators)
      .values({ taskId, userId: collaboratorId })
      .returning();
  }
}
```

---

# 🧱 11. Final Principles

### 1. Schema is the source of truth

### 2. All business logic lives in Services

### 3. Handlers stay thin

### 4. Validation flows from the DB to the route

### 5. Keep the workflow consistent and repeatable

---
