/**
 * Task-specific API functions for React Router
 * This runs on the server during SSR
 *
 * Development (local): Uses http://localhost:9999
 * Production (Docker): Uses http://api:9999 via API_URL env var
 */

import { apiRequest } from '../api.server';

// Get all tasks
export async function getTasks() {
  return apiRequest<Array<{ id: number; name: string; done: boolean }>>(
    '/tasks'
  );
}

// Get single task
export async function getTask(id: number) {
  return apiRequest<{ id: number; name: string; done: boolean }>(
    `/tasks/${id}`
  );
}

// Create task
export async function createTask(data: { name: string; done?: boolean }) {
  return apiRequest<{ id: number; name: string; done: boolean }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update task
export async function updateTask(
  id: number,
  data: { name?: string; done?: boolean }
) {
  return apiRequest<{ id: number; name: string; done: boolean }>(
    `/tasks/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );
}

// Delete task
export async function deleteTask(id: number) {
  return apiRequest<void>(`/tasks/${id}`, {
    method: 'DELETE',
  });
}
