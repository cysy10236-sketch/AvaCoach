/**
 * API base URL configuration.
 *
 * - Development: empty string → Vite proxy forwards /api to localhost:3001
 * - Production: set VITE_API_BASE_URL to your Render backend, e.g. https://avacoach.onrender.com
 */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
}

export function getApiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`
}
