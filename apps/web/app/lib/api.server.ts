/**
 * Server-side API client for React Router
 * This runs on the server during SSR
 *
 * Development (local): Uses http://localhost:9999
 * Production (Docker): Uses http://api:9999 via API_URL env var
 */

// In local dev, use localhost since we're not in Docker
// In production/Docker, use the API_URL env var (http://api:9999)
const API_BASE_URL = process.env.API_URL || 'http://localhost:9999';

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

