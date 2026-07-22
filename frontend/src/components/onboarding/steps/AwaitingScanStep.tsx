'use client';

/**
 * AwaitingScanStep component.
 * Displays a waiting state with progress animation while polling for
 * first scan data from the connected cluster agent.
 * Auto-advances to the celebration step when scan data arrives.
 * Validates: Requirements 8.1
 */

import { useEffect, useRef } from 'react';
import type { StepProps } from '../types';

/** Delay in ms before auto-advancing (simulates scan arrival for now) */
const SCAN_ARRIVAL_DELAY_MS = 20_000;

export function AwaitingScanStep({ next, back }: StepProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Option A: Start a timer on mount. After the delay, auto-advance via next().
    // In a future iteration this will be replaced with real polling against
    // cluster/investigation endpoints to detect actual scan data arrival.
    timerRef.current = setTimeout(() => {
      next();
    }, SCAN_ARRIVAL_DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [next]);

  return (
    <div className="kbo-center">
      <div className="kbo-spin kbo-spin-lg" style={{ marginBottom: 24 }} />

      <h2 className="kbo-title">Agent connected &mdash; waiting for first scan data</h2>
      <p className="kbo-sub">This usually takes less than a minute</p>

      <div className="kbo-actions">
        <button type="button" onClick={back} className="kbo-btn-ghost">Back</button>
      </div>
    </div>
  );
}
