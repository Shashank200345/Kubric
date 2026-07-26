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

type Shell = 'bash' | 'powershell' | 'cmd';

const SHELLS: { id: Shell; label: string }[] = [
  { id: 'bash', label: 'macOS / Linux' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'cmd', label: 'Windows CMD' },
];

/**
 * Reformat the single-line Helm command with the correct line-continuation
 * character for the chosen shell (bash: \, PowerShell: `, cmd: ^) so users can
 * copy a version that actually runs in their terminal.
 */
function formatHelmCommand(cmd: string, shell: Shell): string {
  if (!cmd) return '';
  const [head, ...sets] = cmd.split(' --set ');
  const segments = [head.trim(), ...sets.map((s) => '--set ' + s.trim())];
  const cont = shell === 'bash' ? ' \\' : shell === 'powershell' ? ' `' : ' ^';
  return segments.join(cont + '\n  ');
}

/** Pick a sensible default tab based on the user's OS. */
function detectShell(): Shell {
  if (typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent)) {
    return 'powershell';
  }
  return 'bash';
}

export function WebTokenStep({ wizardState, next, back }: StepProps) {
  const [helmCommand, setHelmCommand] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shell, setShell] = useState<Shell>(detectShell);
  const [timedOut, setTimedOut] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingStartRef = useRef<number | null>(null);
  // Always call the latest `next` without making it an effect dependency
  // (its identity changes on every wizard re-render).
  const nextRef = useRef(next);
  nextRef.current = next;
  // Guard so the token is generated exactly once, even if the effect re-runs.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
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
              nextRef.current();
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
    // Run once on mount; `next` is read via nextRef to avoid re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual escape hatch: let the user proceed even if the heartbeat wasn't
  // auto-detected (pod still starting, slow first heartbeat, restricted egress,
  // etc.). The cluster will still appear in the dashboard once it reports in.
  function handleContinueAnyway() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    nextRef.current();
  }

  async function handleCopy() {
    if (!helmCommand) return;
    try {
      await navigator.clipboard.writeText(formatHelmCommand(helmCommand, shell));
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

      {/* Shell selector — pick the syntax that matches your terminal */}
      <div
        role="tablist"
        aria-label="Terminal type"
        style={{ display: 'flex', gap: 6, marginTop: 24, marginBottom: 10 }}
      >
        {SHELLS.map((s) => {
          const active = s.id === shell;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setShell(s.id)}
              style={{
                fontFamily: 'inherit',
                fontSize: 12,
                padding: '6px 12px',
                cursor: 'pointer',
                color: active ? '#05140c' : 'rgba(255,255,255,0.6)',
                background: active ? '#7cffb2' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? '#7cffb2' : 'rgba(255,255,255,0.14)'}`,
                transition: 'all .15s ease',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="kbo-code-wrap">
        <pre className="kbo-code"><code>{formatHelmCommand(helmCommand || '', shell)}</code></pre>
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
          Still waiting… Check that the Helm command ran successfully and the
          agent pod is <code>Running</code> (<code>kubectl -n kubric-system get pods</code>),
          the cluster has outbound internet access, and the cluster name matches.
          You can continue anyway — the cluster will appear once it reports in.
        </div>
      )}

      <p className="kbo-sub" style={{ marginTop: 16, fontSize: 12.5, opacity: 0.8 }}>
        Already ran the command? You don&apos;t have to wait here.
      </p>

      <div className="kbo-actions">
        <button type="button" onClick={back} className="kbo-btn-ghost">Back</button>
        <button type="button" onClick={handleContinueAnyway} className="kbo-btn">
          Continue anyway →
        </button>
      </div>
    </div>
  );
}
