'use client';

/**
 * Reusable EmptyState component for dashboard screens.
 * Displays a screen-specific message, illustration placeholder,
 * and a "Connect a Cluster" CTA button when no clusters are connected.
 * Validates: Requirements 11.1, 11.2
 */

import './onboarding.css';
import { EMPTY_STATE_SCREENS } from './types';

// --- Props ---

export interface EmptyStateProps {
  screen: 'overview' | 'incidents' | 'prrisk' | 'workloads' | 'nodes' | 'playbooks' | 'ask';
  onConnectCluster: () => void;
}

// --- Screen icon map ---

const SCREEN_ICONS: Record<EmptyStateProps['screen'], React.ReactNode> = {
  overview: (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13h2v8H3zm6-4h2v12H9zm6-3h2v15h-2zm6-4h2v19h-2z" />
    </svg>
  ),
  incidents: (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M4.93 19h14.14c1.1 0 1.77-1.2 1.2-2.14L13.2 4.86c-.57-.94-1.83-.94-2.4 0L3.73 16.86c-.57.94.1 2.14 1.2 2.14z" />
    </svg>
  ),
  prrisk: (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  workloads: (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  nodes: (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-7-4h.01M17 16h.01" />
    </svg>
  ),
  playbooks: (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  ask: (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
};

// --- Component ---

export function EmptyState({ screen, onConnectCluster }: EmptyStateProps) {
  const message = EMPTY_STATE_SCREENS[screen];

  return (
    <div
      role="status"
      aria-label={`Empty state for ${screen} screen`}
      className="kbo-empty"
    >
      <div className="kbo-empty-illo">{SCREEN_ICONS[screen]}</div>
      <p className="kbo-empty-msg">{message}</p>
      <button type="button" onClick={onConnectCluster} className="kbo-btn">
        Connect a Cluster
      </button>
    </div>
  );
}
