/**
 * Onboarding API client functions.
 * Handles communication with the backend onboarding endpoints.
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 14.2
 */

import { insforge } from '@/lib/insforge';
import { API_BASE } from '@/lib/api';
import type { OnboardingStep } from './types';

// --- Response Types ---

export interface OnboardingStateResponse {
  current_step: OnboardingStep;
  cluster_name: string | null;
  connection_method: 'web_token' | 'cli' | null;
  trust_mode: 'suggest' | 'approve' | 'auto';
  invited_emails: string[];
  completed_steps: OnboardingStep[];
  step_timestamps: Record<string, string>;
  is_complete: boolean;
}

export interface StepUpdateResponse {
  current_step: OnboardingStep;
  completed_steps: OnboardingStep[];
}

export interface ClusterTokenResponse {
  cluster_token: string;
  helm_command: string;
}

export interface HeartbeatResponse {
  connected: boolean;
  first_heartbeat_at: string | null;
}

export interface InviteResponse {
  sent: number;
  failed: string[];
}

// --- Helpers ---

/**
 * Retrieves the current user's Bearer token from the InsForge SDK.
 * Throws if no valid session is available.
 */
function getAuthToken(): string {
  const authHeader = insforge.getHttpClient().getHeaders()['Authorization'];
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;
  if (!token) {
    throw new Error('No authentication token available. Please log in.');
  }
  return token;
}

/**
 * Error thrown by authFetch that preserves the HTTP status code so callers
 * can branch on specific statuses (e.g. 404 -> no record).
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Makes an authenticated fetch request to the onboarding API.
 */
async function authFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const url = `${API_BASE}/api/v1/onboarding${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = (errorBody as { detail?: string }).detail || `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

// --- API Functions ---

/**
 * Fetches the current onboarding state for the authenticated user.
 * Returns null if no onboarding record exists (404).
 * Validates: Requirement 13.1
 */
export async function fetchOnboardingState(): Promise<OnboardingStateResponse | null> {
  try {
    return await authFetch<OnboardingStateResponse>('/state');
  } catch (error) {
    // 404 means no onboarding record — return null for fresh wizard initialization
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Updates a specific onboarding step's completion status.
 * Validates: Requirement 13.2
 */
export async function updateStep(
  step: OnboardingStep,
  data: Record<string, unknown> = {}
): Promise<StepUpdateResponse> {
  return authFetch<StepUpdateResponse>('/step', {
    method: 'PATCH',
    body: JSON.stringify({ step, data }),
  });
}

/**
 * Generates a cluster token and returns the pre-filled Helm install command.
 * Validates: Requirement 13.3
 */
export async function generateClusterToken(
  clusterName: string
): Promise<ClusterTokenResponse> {
  return authFetch<ClusterTokenResponse>('/cluster-token', {
    method: 'POST',
    body: JSON.stringify({ cluster_name: clusterName }),
  });
}

/**
 * Checks whether a heartbeat has been received for the given cluster.
 * Validates: Requirement 14.2
 */
export async function checkHeartbeat(
  clusterName: string
): Promise<HeartbeatResponse> {
  return authFetch<HeartbeatResponse>(`/heartbeat/${encodeURIComponent(clusterName)}`);
}

/**
 * Sends team invitation emails to the provided addresses.
 * Validates: Requirement 13.4
 */
export async function sendInvites(
  emails: string[]
): Promise<InviteResponse> {
  return authFetch<InviteResponse>('/invite', {
    method: 'POST',
    body: JSON.stringify({ emails }),
  });
}
