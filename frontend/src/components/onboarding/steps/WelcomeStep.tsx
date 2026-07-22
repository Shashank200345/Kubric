'use client';

/**
 * WelcomeStep component — the first step of the onboarding wizard.
 * Displays a greeting, overview of what's ahead, and a "Get Started" button.
 * No "Skip Setup" link or back button on this step.
 * Validates: Requirements 1.3
 */

import type { StepProps } from '../types';

export function WelcomeStep({ next }: StepProps) {
  const items = [
    'Name your cluster',
    'Connect your agent',
    'Choose your trust mode',
    'Invite your team',
  ];

  return (
    <div className="kbo-center">
      <h1 className="kbo-title">
        Welcome to <span className="accent">Kubric</span>
      </h1>
      <p className="kbo-sub">Let&apos;s set up your first cluster in just a few steps.</p>

      <ul className="kbo-numlist" style={{ margin: '32px 0', textAlign: 'left' }}>
        {items.map((label, i) => (
          <li key={label} className="kbo-numrow">
            <span className="kbo-num">{i + 1}</span>
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <button type="button" onClick={next} className="kbo-btn kbo-btn-lg">
        Get Started
      </button>
    </div>
  );
}
