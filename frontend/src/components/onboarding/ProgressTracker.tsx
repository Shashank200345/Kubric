'use client';

/**
 * ProgressTracker sidebar component for the onboarding wizard.
 * Renders a vertical step list with visual state indicators and completion percentage.
 * Validates: Requirements 1.2, 10.1, 10.2, 10.3
 */

import type { OnboardingStep } from './types';

export interface ProgressTrackerProps {
  steps: { id: OnboardingStep; label: string }[];
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  onStepClick: (step: OnboardingStep) => void;
}

export function ProgressTracker({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: ProgressTrackerProps) {
  const completionPercentage = Math.floor(
    (completedSteps.length / steps.length) * 100
  );

  return (
    <>
      {/* Completion percentage */}
      <div>
        <div className="kbo-progress-head" style={{ marginBottom: 8 }}>
          <span>Progress</span>
          <span className="kbo-progress-pct">{completionPercentage}%</span>
        </div>
        <div className="kbo-progress-bar">
          <div className="kbo-progress-fill" style={{ width: `${completionPercentage}%` }} />
        </div>
      </div>

      {/* Step list */}
      <ul role="list" className="kbo-steps" aria-label="Onboarding progress">
        {steps.map((step, i) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = step.id === currentStep;
          const cls = isCompleted ? 'kbo-step done' : isCurrent ? 'kbo-step active' : 'kbo-step future';

          const content = (
            <>
              <span className="kbo-step-dot" aria-hidden="true">
                {isCompleted ? (
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span>{step.label}</span>
            </>
          );

          return (
            <li key={step.id}>
              {isCompleted ? (
                <button
                  type="button"
                  onClick={() => onStepClick(step.id)}
                  className={cls}
                  aria-label={`${step.label} (completed, click to review)`}
                >
                  {content}
                </button>
              ) : (
                <div className={cls} aria-current={isCurrent ? 'step' : undefined}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
