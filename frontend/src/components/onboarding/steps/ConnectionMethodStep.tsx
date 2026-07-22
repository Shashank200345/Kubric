'use client';

/**
 * ConnectionMethodStep component — lets the user choose between
 * Web Token Flow and CLI Flow for connecting their cluster.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import type { StepProps } from '../types';

interface ConnectionOption {
  id: 'web_token' | 'cli';
  title: string;
  description: string;
}

const CONNECTION_OPTIONS: ConnectionOption[] = [
  {
    id: 'web_token',
    title: 'Web Token Flow',
    description: 'Generate a token and run a Helm command',
  },
  {
    id: 'cli',
    title: 'CLI Flow',
    description: 'Use the kubric CLI to connect in one command',
  },
];

export function ConnectionMethodStep({
  wizardState,
  updateState,
  next,
  back,
}: StepProps) {
  const handleSelect = (method: 'web_token' | 'cli') => {
    updateState({ connectionMethod: method });
    next();
  };

  return (
    <div className="kbo-center">
      <h1 className="kbo-title">Choose Connection Method</h1>
      <p className="kbo-sub">How would you like to connect your cluster to Kubric?</p>

      <div className="kbo-card-grid" style={{ margin: '32px 0' }}>
        {CONNECTION_OPTIONS.map((option) => {
          const isSelected = wizardState.connectionMethod === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              className={`kbo-card ${isSelected ? 'selected' : ''}`}
            >
              <span className="kbo-card-title">{option.title}</span>
              <span className="kbo-card-desc">{option.description}</span>
            </button>
          );
        })}
      </div>

      <button type="button" onClick={back} className="kbo-btn-ghost">Back</button>
    </div>
  );
}
