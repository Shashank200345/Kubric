'use client';

/**
 * TrustModeStep component.
 * Presents three trust mode options (Suggest, Approve, Auto-fix)
 * and persists the user's choice via the wizard state.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

import { useState } from 'react';
import type { StepProps } from '../types';

type TrustMode = 'suggest' | 'approve' | 'auto';

interface TrustModeOption {
  id: TrustMode;
  label: string;
  description: string;
}

const TRUST_MODE_OPTIONS: TrustModeOption[] = [
  {
    id: 'suggest',
    label: 'Suggest',
    description:
      'Kubric will analyze issues and suggest fixes for you to review. No changes are made automatically.',
  },
  {
    id: 'approve',
    label: 'Approve',
    description:
      'Kubric will propose fixes that you can approve or reject with one click. Recommended for most teams.',
  },
  {
    id: 'auto',
    label: 'Auto-fix',
    description:
      'Kubric will automatically apply safe fixes to known issues. You\u2019ll be notified after each fix.',
  },
];

export function TrustModeStep({ wizardState, updateState, next, back }: StepProps) {
  const [selectedMode, setSelectedMode] = useState<TrustMode>(
    wizardState.trustMode ?? 'approve'
  );

  const handleConfirm = () => {
    updateState({ trustMode: selectedMode });
    next();
  };

  return (
    <div className="kbo-body">
      <div>
        <h2 className="kbo-title">Select Trust Mode</h2>
        <p className="kbo-sub">
          Choose how much automation Kubric uses when managing your cluster. You can
          change this later in Settings.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
        {TRUST_MODE_OPTIONS.map((option) => {
          const isSelected = selectedMode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedMode(option.id)}
              className={`kbo-option ${isSelected ? 'selected' : ''}`}
              aria-pressed={isSelected}
            >
              <span className="kbo-radio">
                {isSelected && <span className="kbo-radio-dot" />}
              </span>
              <div>
                <span className="kbo-option-label">{option.label}</span>
                {option.id === 'approve' && <span className="kbo-badge">Recommended</span>}
                <p className="kbo-option-desc">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="kbo-actions">
        <button type="button" onClick={back} className="kbo-btn-ghost">Back</button>
        <button type="button" onClick={handleConfirm} className="kbo-btn">Confirm</button>
      </div>
    </div>
  );
}
