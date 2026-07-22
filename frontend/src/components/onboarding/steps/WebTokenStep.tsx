'use client';

/**
 * WebTokenStep component — generates a cluster token, displays the Helm install
 * command with a copy button, and polls for heartbeat to auto-advance.
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { useEffect, useRef, useState } from 'react';
import type { StepProps } from '../types';
import { generateClusterToken, checkHeartbeat } from '../api';

const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 300000; // 5 minutes

export function WebTokenStep({ wizardState, next, back }: StepProps) {
  const [helmCommand, setHelmCommand] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingStartRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const response = await generateClusterToken(wizardState.clusterName!);
        if (cancelled) return;
        setHelmCommand(response.helm_command);
        setLoading(false);

        // Start heartbeat polling
        pollingStartRef.current = Date.now();

        intervalRef.current = setInterval(async () => {
          // Check for timeout
          if (
            pollingStartRef.current &&
            Date.now() - pollingStartRef.current > TIMEOUT_MS
          ) {
            setTimedOut(true);
          }

          try {
            const heartbeat = await checkHeartbeat(wizardState.clusterName!);
            if (heartbeat.connected) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              next();
            }
          } catch {
            // Silently ignore heartbeat polling errors
          }
        }, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to generate token. Please try again.'
        );
        setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [wizardState.clusterName, next]);

  async function handleCopy() {
    if (!helmCommand) return;
    try {
      await navigator.clipboard.writeText(helmCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing if clipboard API not available
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="kbo-center">
        <div className="kbo-spin kbo-spin-lg" style={{ marginBottom: 16 }} />
        <p className="kbo-sub">Generating cluster token…</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="kbo-center">
        <p className="kbo-sub" style={{ color: 'var(--crit)' }} role="alert">{error}</p>
        <button type="button" onClick={back} className="kbo-btn-ghost" style={{ marginTop: 16 }}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="kbo-center">
      <h2 className="kbo-title">Connect via Web Token</h2>
      <p className="kbo-sub">
        Run the following Helm command in your cluster to install the Kubric agent.
        We&apos;ll detect the connection automatically.
      </p>

      <div className="kbo-code-wrap" style={{ marginTop: 24 }}>
        <pre className="kbo-code"><code>{helmCommand}</code></pre>
        <button
          type="button"
          onClick={handleCopy}
          className="kbo-copy"
          aria-label="Copy Helm command to clipboard"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="kbo-wait" style={{ marginTop: 20 }}>
        <span className="kbo-spin" />
        <span>Waiting for cluster heartbeat…</span>
      </div>

      {timedOut && (
        <div className="kbo-note">
          Still waiting… Check that the Helm command ran successfully in your
          cluster. Make sure the cluster has outbound internet access and the
          agent pod is running.
        </div>
      )}

      <div className="kbo-actions">
        <button type="button" onClick={back} className="kbo-btn-ghost">Back</button>
      </div>
    </div>
  );
}
