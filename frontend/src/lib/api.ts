/**
 * Base URL for the Kubric backend API.
 * Override per-environment with NEXT_PUBLIC_API_URL; falls back to localhost for dev.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';
