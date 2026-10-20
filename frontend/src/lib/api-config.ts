// frontend/src/lib/api-config.ts

/**
 * Resolves the backend HTTP API base URL dynamically.
 * Priority:
 * 1. Explicit NEXT_PUBLIC_API_URL (if not generic localhost)
 * 2. Active browser hostname with port 4000 (allows seamless LAN / multi-device access)
 * 3. Default localhost:4000 fallback for SSR
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:4000`;
  }
  return 'http://localhost:4000';
}

/**
 * Resolves the backend WebSocket base URL dynamically.
 * Priority:
 * 1. Explicit NEXT_PUBLIC_WS_URL (if not generic localhost)
 * 2. Active browser hostname with port 4000
 * 3. Default localhost:4000 fallback for SSR
 */
export function getWsBaseUrl(): string {
  const envWs = process.env.NEXT_PUBLIC_WS_URL;
  if (envWs && !envWs.includes('localhost')) {
    return envWs;
  }
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:4000`;
  }
  return 'http://localhost:4000';
}
