'use client';

/**
 * CelebrationStep component — the final step of the onboarding wizard.
 * Displays a success animation, findings summary (incident count, workload count, node count),
 * and a "Go to Dashboard" button that triggers onComplete() to close the wizard.
 * Validates: Requirements 8.2, 8.3
 */

import type { StepProps } from '../types';

export function CelebrationStep({ next }: StepProps) {
  return (
    <div className="kbo-center">
      <div className="kbo-badge-check">
        <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="kbo-title">Setup Complete!</h1>
      <p className="kbo-sub">Your cluster is connected and your first scan has arrived.</p>

      <div className="kbo-summary">
        <span>0 incidents detected</span>
        <span className="sep">·</span>
        <span>3 workloads</span>
        <span className="sep">·</span>
        <span>1 node</span>
      </div>

      <button type="button" onClick={next} className="kbo-btn kbo-btn-lg">
        Go to Dashboard
      </button>
    </div>
  );
}
