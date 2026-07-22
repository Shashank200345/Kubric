'use client';

/**
 * ClusterNameStep component — collects and validates the cluster name.
 * Renders a text input with placeholder examples, validates on submit using
 * validateClusterName, and shows inline error if invalid.
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import { useState, type FormEvent } from 'react';
import type { StepProps } from '../types';
import { validateClusterName } from '../validators';

export function ClusterNameStep({ wizardState, updateState, next, back }: StepProps) {
  const [clusterName, setClusterName] = useState(wizardState.clusterName ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const result = validateClusterName(clusterName.trim());

    if (!result.valid) {
      setError(result.error ?? 'Invalid cluster name');
      return;
    }

    setError(null);
    updateState({ clusterName: clusterName.trim() });
    next();
  }

  return (
    <div className="kbo-center">
      <h2 className="kbo-title">Name Your Cluster</h2>
      <p className="kbo-sub">
        Give your cluster a descriptive name. Use lowercase letters, numbers, and hyphens only (3–63 characters).
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 440, marginTop: 28 }}>
        <label htmlFor="cluster-name-input" className="kbo-label">Cluster Name</label>
        <input
          id="cluster-name-input"
          type="text"
          value={clusterName}
          onChange={(e) => {
            setClusterName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="production-eks, staging-gke"
          className={`kbo-input ${error ? 'error' : ''}`}
          autoFocus
        />
        {error && (
          <p className="kbo-error" role="alert">{error}</p>
        )}

        <div className="kbo-actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" onClick={back} className="kbo-btn-ghost">Back</button>
          <button type="submit" className="kbo-btn">Continue</button>
        </div>
      </form>
    </div>
  );
}
