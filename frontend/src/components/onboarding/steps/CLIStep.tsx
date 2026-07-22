'use client';

/**
 * CLIStep component — displays CLI connection instructions with OS-specific
 * install commands and polls for heartbeat to auto-advance.
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StepProps } from '../types';
import { checkHeartbeat } from '../api';
import { getCliInstallCommand } from '../validators';

type DetectedOS = 'macos' | 'windows' | 'linux';

/**
 * Detects the user's operating system from navigator info.
 */
function detectOS(): DetectedOS {
  if (typeof navigator === 'undefined') return 'linux';

  const platform = navigator.platform?.toLowerCase() ?? '';
  const userAgent = navigator.userAgent?.toLowerCase() ?? '';

  if (platform.includes('mac') || userAgent.includes('mac')) return 'macos';
  if (platform.includes('win') || userAgent.includes('win')) return 'windows';
  return 'linux';
}

export function CLIStep({ wizardState, back, next }: StepProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const troubleshootTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [detectedOS, setDetectedOS] = useState<DetectedOS>('linux');

  // Detect OS on client side
  useEffect(() => {
    setDetectedOS(detectOS());
  }, []);

  // Poll heartbeat every 5 seconds
  useEffect(() => {
    if (!wizardState.clusterName) return;

    const clusterName = wizardState.clusterName;

    async function poll() {
      try {
        const response = await checkHeartbeat(clusterName);
        if (response.connected) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          next();
        }
      } catch {
        // Silently ignore polling errors
      }
    }

    // Start polling immediately then every 5 seconds
    poll();
    intervalRef.current = setInterval(poll, 5000);

    // Show troubleshooting after 5 minutes
    troubleshootTimerRef.current = setTimeout(() => {
      setShowTroubleshooting(true);
    }, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (troubleshootTimerRef.current) clearTimeout(troubleshootTimerRef.current);
    };
  }, [wizardState.clusterName, next]);

  const installCommand = getCliInstallCommand(detectedOS);
  const loginCommand = 'kubric login';
  const connectCommand = `kubric connect ${wizardState.clusterName}`;

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }

  const osLabel = detectedOS === 'macos' ? 'macOS' : detectedOS === 'windows' ? 'Windows' : 'Linux';
  const steps: { n: number; label: ReactNode; cmd: string; key: string }[] = [
    {
      n: 1,
      key: 'install',
      label: (
        <>Install the kubric CLI <span style={{ color: 'var(--t3)', fontSize: 11 }}>({osLabel} detected)</span></>
      ),
      cmd: installCommand,
    },
    { n: 2, key: 'login', label: 'Log in to your account', cmd: loginCommand },
    { n: 3, key: 'connect', label: 'Connect your cluster', cmd: connectCommand },
  ];

  return (
    <div className="kbo-center">
      <h2 className="kbo-title">Connect via CLI</h2>
      <p className="kbo-sub">Follow the steps below to connect your cluster using the kubric CLI.</p>

      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, marginTop: 28 }}>
        {steps.map((s) => (
          <div key={s.key}>
            <div className="kbo-numrow" style={{ marginBottom: 8 }}>
              <span className="kbo-num">{s.n}</span>
              <span style={{ color: 'var(--t1)', fontSize: 13 }}>{s.label}</span>
            </div>
            <div className="kbo-code-wrap">
              <pre className="kbo-code"><code>{s.cmd}</code></pre>
              <button
                type="button"
                onClick={() => copyToClipboard(s.cmd, s.key)}
                className="kbo-copy"
                aria-label={`Copy ${s.key} command`}
              >
                {copied === s.key ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="kbo-wait" style={{ marginTop: 24 }}>
        <span className="kbo-spin" />
        <span>Waiting for agent connection…</span>
      </div>

      {showTroubleshooting && (
        <div className="kbo-note">
          <strong style={{ display: 'block', marginBottom: 6 }}>Still waiting? Troubleshooting tips:</strong>
          <ul style={{ listStyle: 'disc', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Ensure the CLI is installed: <code>kubric --version</code></li>
            <li>Verify you are logged in: <code>kubric whoami</code></li>
            <li>Check your kubectl context points to the correct cluster</li>
            <li>Ensure outbound HTTPS traffic is allowed from your cluster</li>
          </ul>
        </div>
      )}

      <div className="kbo-actions">
        <button type="button" onClick={back} className="kbo-btn-ghost">Back</button>
      </div>
    </div>
  );
}
