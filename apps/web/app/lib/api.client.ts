/**
 * Client-side API client for React Router
 * This runs in the browser and uses public-facing URLs
 */

// Use environment variable or default to localhost for client-side
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9999';

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Client-side API functions
export async function getTasks() {
  return apiRequest<Array<{ id: number; name: string; done: boolean }>>(
    '/tasks'
  );
}

export async function getTask(id: number) {
  return apiRequest<{ id: number; name: string; done: boolean }>(
    `/tasks/${id}`
  );
}

export async function createTask(data: { name: string; done?: boolean }) {
  return apiRequest<{ id: number; name: string; done: boolean }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

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

export async function deleteTask(id: number) {
  return apiRequest<void>(`/tasks/${id}`, {
    method: 'DELETE',
  });
}
