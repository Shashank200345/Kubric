'use client';

/**
 * TeamInviteStep component.
 * Allows the user to invite team members via email.
 * Renders an email input with validation, a list of added emails with remove,
 * and options to send invites or skip the step.
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useState } from 'react';
import type { StepProps } from '../types';
import { validateEmail } from '../validators';
import { sendInvites } from '../api';

export function TeamInviteStep({ wizardState, updateState, next, back }: StepProps) {
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState('');
  const [emailList, setEmailList] = useState<string[]>(
    wizardState.invitedEmails ?? []
  );
  const [loading, setLoading] = useState(false);

  const handleAddEmail = () => {
    const trimmed = emailInput.trim();

    if (!trimmed) {
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }

    if (emailList.includes(trimmed)) {
      setError('This email has already been added');
      return;
    }

    setEmailList([...emailList, trimmed]);
    setEmailInput('');
    setError('');
  };

  const handleRemoveEmail = (email: string) => {
    setEmailList(emailList.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleSendInvites = async () => {
    if (emailList.length === 0) return;

    setLoading(true);
    try {
      await sendInvites(emailList);
      updateState({ invitedEmails: emailList });
      next();
    } catch {
      setError('Failed to send invitations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    next();
  };

  return (
    <div className="kbo-body">
      <div>
        <h2 className="kbo-title">Invite Your Team</h2>
        <p className="kbo-sub">
          Add team members who should have access to this Kubric workspace. You can
          always invite more people later from Settings.
        </p>
      </div>

      {/* Email Input */}
      <div style={{ marginTop: 28 }}>
        <label htmlFor="team-email-input" className="kbo-label">Email address</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="team-email-input"
            type="email"
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="colleague@company.com"
            className={`kbo-input ${error ? 'error' : ''}`}
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? 'email-error' : undefined}
          />
          <button type="button" onClick={handleAddEmail} disabled={loading} className="kbo-btn-ghost">
            Add
          </button>
        </div>
        {error && (
          <p id="email-error" className="kbo-error" role="alert">{error}</p>
        )}
      </div>

      {/* Email List */}
      <div style={{ flex: 1, marginTop: 16, overflowY: 'auto' }}>
        {emailList.length > 0 ? (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Invited emails">
            {emailList.map((email) => (
              <li key={email} className="kbo-email-row">
                <span className="kbo-email-addr">{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  disabled={loading}
                  className="kbo-email-remove"
                  aria-label={`Remove ${email}`}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="kbo-sub" style={{ fontStyle: 'italic' }}>
            No team members added yet. Add emails above or skip this step.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="kbo-actions">
        <button type="button" onClick={back} disabled={loading} className="kbo-btn-ghost">Back</button>
        <button type="button" onClick={handleSkip} disabled={loading} className="kbo-btn-ghost">Skip</button>
        <button
          type="button"
          onClick={handleSendInvites}
          disabled={loading || emailList.length === 0}
          className="kbo-btn"
        >
          {loading ? 'Sending…' : 'Send Invites & Continue'}
        </button>
      </div>
    </div>
  );
}
