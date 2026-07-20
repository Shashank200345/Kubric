/**
 * Base URL for the Kubric backend API.
 * Override per-environment with NEXT_PUBLIC_API_URL; falls back to localhost for dev.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';

/**
 * Authenticated fetch for dashboard read endpoints.
 * Adds the user's InsForge JWT so the backend can scope cluster_state by user_id
 * in agent (push) mode. Falls through gracefully in local mode.
 */
export async function apiFetch(path: string, opts?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts?.headers as Record<string, string> || {}),
  };

  // Try to attach the current user token if the insforge SDK is available on the
  // client. This import is lazy so tree-shaking isn't affected.
  try {
    const { insforge } = await import('@/lib/insforge');
    const authHeader = insforge.getHttpClient().getHeaders()['Authorization'];
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
  } catch {
    // insforge SDK not available on this page — proceed without token.
  }

  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}
