import { Form, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/tasks";
import * as taskApi from "~/lib/api/tasks.server";

/**
 * LOADER - Runs on the server during SSR
 * Uses tasks.server.ts which connects via Docker network (http://api:9999)
 */
export async function loader({ }: Route.LoaderArgs) {
  try {
    const tasks = await taskApi.getTasks();
    return { tasks };
  } catch (error) {
    console.error("Failed to load tasks:", error);
    return { tasks: [] };
  }
}

/**
 * ACTION - Handles form submissions on the server
 * Also uses tasks.server.ts for server-side operations
 */
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "create") {
      const name = formData.get("name") as string;
      await taskApi.createTask({ name, done: false });
    } else if (intent === "toggle") {
      const id = Number(formData.get("id"));
      const done = formData.get("done") === "true";
      await taskApi.updateTask(id, { done: !done });
    } else if (intent === "delete") {
      const id = Number(formData.get("id"));
      await taskApi.deleteTask(id);
    }

    return { success: true };
  } catch (error) {
    console.error("Action failed:", error);
    return { success: false, error: String(error) };
  }
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Tasks - My App" },
    { name: "description", content: "Manage your tasks" },
  ];
}

/**
 * COMPONENT - Renders on both server and client
 * Uses loader data for initial render, Form for mutations
 */
export default function Tasks() {
  const { tasks } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className="pt-16 p-4 container mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Tasks</h1>

      {/* Create Task Form */}
      <Form method="post" className="mb-8">
        <input type="hidden" name="intent" value="create" />
        <div className="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="New task..."
            required
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : "Add Task"}
          </button>
        </div>
      </Form>

      {/* Tasks List */}
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No tasks yet. Create one above!
          </p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-4 bg-z border rounded-lg hover:shadow-md transition-shadow"
            >
              {/* Toggle Task Form */}
              <Form method="post" className="flex-shrink-0">
                <input type="hidden" name="intent" value="toggle" />
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="done" value={String(task.done)} />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-6 h-6 rounded border-2 flex items-center justify-center hover:border-blue-500 transition-colors"
                >
                  {task.done && (
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </Form>

              <span
                className={`flex-1 ${task.done ? "line-through text-gray-400" : ""}`}
              >
                {task.name}
              </span>

              {/* Delete Task Form */}
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={task.id} />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  Delete
                </button>
              </Form>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 text-sm text-gray-500">
        <p>
          <strong>Architecture Note:</strong> This page demonstrates proper service communication:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Server-side: React Router SSR → Hono API (via Docker network: http://api:9999) → PostgreSQL</li>
          <li>Client-side: Forms post to React Router actions (which use the API internally)</li>
          <li>Frontend NEVER connects directly to PostgreSQL</li>
        </ul>
      </div>
    </main>
  );
}
