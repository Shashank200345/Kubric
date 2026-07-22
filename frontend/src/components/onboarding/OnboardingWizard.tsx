'use client';

/**
 * OnboardingWizard container component.
 * Manages the full onboarding flow: fetches state, handles step navigation,
 * persists progress, and renders the ProgressTracker sidebar + active step.
 * Validates: Requirements 1.1, 1.2, 1.3, 9.2, 12.1, 12.2
 */

import { useEffect, useState, useCallback } from 'react';
import './onboarding.css';
import type { OnboardingStep, WizardState } from './types';
import { ONBOARDING_STEPS } from './types';
import { fetchOnboardingState, updateStep } from './api';
import { ProgressTracker } from './ProgressTracker';
import { WelcomeStep } from './steps/WelcomeStep';
import { ClusterNameStep } from './steps/ClusterNameStep';
import { ConnectionMethodStep } from './steps/ConnectionMethodStep';
import { WebTokenStep } from './steps/WebTokenStep';
import { CLIStep } from './steps/CLIStep';
import { TrustModeStep } from './steps/TrustModeStep';
import { TeamInviteStep } from './steps/TeamInviteStep';
import { AwaitingScanStep } from './steps/AwaitingScanStep';
import { CelebrationStep } from './steps/CelebrationStep';

// --- Props ---

interface OnboardingWizardProps {
  user: { id: string; email?: string };
  onComplete: () => void;
}

// --- Step sequence logic ---

/** The canonical step order (excluding the branching step not chosen) */
const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'cluster_name',
  'connection_method',
  'web_token',
  'cli',
  'trust_mode',
  'team_invite',
  'awaiting_scan',
  'celebration',
];

/**
 * Returns the filtered step order based on the chosen connection method.
 * If web_token was chosen, removes 'cli' from the sequence and vice versa.
 * If no method chosen yet, includes both (they won't be reached until the choice is made).
 */
function getFilteredSteps(
  connectionMethod: 'web_token' | 'cli' | null
): OnboardingStep[] {
  if (connectionMethod === 'web_token') {
    return STEP_ORDER.filter((s) => s !== 'cli');
  }
  if (connectionMethod === 'cli') {
    return STEP_ORDER.filter((s) => s !== 'web_token');
  }
  return STEP_ORDER;
}

/**
 * Returns the next step in the sequence given the current step and connection method.
 */
function getNextStep(
  currentStep: OnboardingStep,
  connectionMethod: 'web_token' | 'cli' | null
): OnboardingStep | null {
  // Special handling: after connection_method, go to the chosen branch
  if (currentStep === 'connection_method') {
    if (connectionMethod === 'web_token') return 'web_token';
    if (connectionMethod === 'cli') return 'cli';
    // Should not happen — connection method should be set before advancing
    return 'web_token';
  }

  const filtered = getFilteredSteps(connectionMethod);
  const currentIndex = filtered.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= filtered.length - 1) {
    return null;
  }
  return filtered[currentIndex + 1];
}

/**
 * Returns the previous step in the sequence given the current step and connection method.
 */
function getPreviousStep(
  currentStep: OnboardingStep,
  connectionMethod: 'web_token' | 'cli' | null
): OnboardingStep | null {
  // Special handling: from web_token or cli, go back to connection_method
  if (currentStep === 'web_token' || currentStep === 'cli') {
    return 'connection_method';
  }

  const filtered = getFilteredSteps(connectionMethod);
  const currentIndex = filtered.indexOf(currentStep);
  if (currentIndex <= 0) {
    return null;
  }
  return filtered[currentIndex - 1];
}

// --- Initial state ---

const INITIAL_WIZARD_STATE: WizardState = {
  currentStep: 'welcome',
  clusterName: null,
  connectionMethod: null,
  trustMode: 'approve',
  invitedEmails: [],
  completedSteps: [],
};

// --- Component ---

export function OnboardingWizard({ user, onComplete }: OnboardingWizardProps) {
  const [wizardState, setWizardState] = useState<WizardState>(INITIAL_WIZARD_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch onboarding state on mount
  useEffect(() => {
    async function loadState() {
      try {
        const state = await fetchOnboardingState();
        if (state) {
          // Resume from server-persisted state
          setWizardState({
            currentStep: state.current_step,
            clusterName: state.cluster_name,
            connectionMethod: state.connection_method,
            trustMode: state.trust_mode,
            invitedEmails: state.invited_emails,
            completedSteps: state.completed_steps,
          });
        }
        // If null (404), start fresh at 'welcome' — already the default
      } catch (err) {
        setError('Failed to load onboarding state. Please refresh the page.');
        console.error('Failed to fetch onboarding state:', err);
      } finally {
        setLoading(false);
      }
    }

    loadState();
  }, []);

  // Update local wizard state
  const updateWizardState = useCallback((partial: Partial<WizardState>) => {
    setWizardState((prev) => ({ ...prev, ...partial }));
  }, []);

  // Navigate to the next step
  const next = useCallback(async () => {
    const nextStep = getNextStep(
      wizardState.currentStep,
      wizardState.connectionMethod
    );

    if (!nextStep) {
      // We're on the last step (celebration) — complete onboarding
      onComplete();
      return;
    }

    // Persist step completion to the server
    try {
      await updateStep(wizardState.currentStep, {
        cluster_name: wizardState.clusterName,
        connection_method: wizardState.connectionMethod,
        trust_mode: wizardState.trustMode,
        invited_emails: wizardState.invitedEmails,
      });
    } catch (err) {
      console.error('Failed to persist step:', err);
      // Allow UI to proceed even if persistence fails (resilience pattern)
    }

    setWizardState((prev) => ({
      ...prev,
      currentStep: nextStep,
      completedSteps: prev.completedSteps.includes(prev.currentStep)
        ? prev.completedSteps
        : [...prev.completedSteps, prev.currentStep],
    }));
  }, [wizardState, onComplete]);

  // Navigate to the previous step
  const back = useCallback(() => {
    const prevStep = getPreviousStep(
      wizardState.currentStep,
      wizardState.connectionMethod
    );
    if (prevStep) {
      setWizardState((prev) => ({ ...prev, currentStep: prevStep }));
    }
  }, [wizardState.currentStep, wizardState.connectionMethod]);

  // Handle clicking a completed step in the progress tracker
  const handleStepClick = useCallback((step: OnboardingStep) => {
    setWizardState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  // Handle skip setup
  const handleSkip = useCallback(async () => {
    try {
      await updateStep('celebration', { skipped: true });
    } catch (err) {
      console.error('Failed to persist skip:', err);
    }
    onComplete();
  }, [onComplete]);

  // Get the filtered steps for the progress tracker sidebar
  const visibleSteps = ONBOARDING_STEPS.filter((step) => {
    if (wizardState.connectionMethod === 'web_token' && step.id === 'cli') {
      return false;
    }
    if (wizardState.connectionMethod === 'cli' && step.id === 'web_token') {
      return false;
    }
    return true;
  });

  // --- Render ---

  if (loading) {
    return (
      <div className="kbo" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="kbo-spin kbo-spin-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="kbo-center" style={{ minHeight: 400 }}>
        <p className="kbo-sub" style={{ color: 'var(--crit)' }}>{error}</p>
        <button onClick={() => window.location.reload()} className="kbo-btn" style={{ marginTop: 16 }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="kbo">
      {/* Sidebar - Progress Tracker */}
      <aside className="kbo-side">
        <ProgressTracker
          steps={visibleSteps}
          currentStep={wizardState.currentStep}
          completedSteps={wizardState.completedSteps}
          onStepClick={handleStepClick}
        />
      </aside>

      {/* Main Content Area */}
      <main className="kbo-main">
        <div className="kbo-body">
          <StepRenderer
            wizardState={wizardState}
            updateState={updateWizardState}
            next={next}
            back={back}
          />
        </div>

        {/* Skip Setup Link (visible on all steps except welcome) */}
        {wizardState.currentStep !== 'welcome' && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '0.5px solid var(--bd)' }}>
            <button type="button" onClick={handleSkip} className="kbo-link">
              Skip Setup
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Step Renderer ---

/**
 * Renders the active step component. For steps that don't have their
 * dedicated component yet, renders a placeholder.
 */
function StepRenderer({
  wizardState,
  updateState,
  next,
  back,
}: {
  wizardState: WizardState;
  updateState: (partial: Partial<WizardState>) => void;
  next: () => void;
  back: () => void;
}) {
  const { currentStep } = wizardState;
  const stepProps = { wizardState, updateState, next, back };

  switch (currentStep) {
    case 'welcome':
      return <WelcomeStep {...stepProps} />;
    case 'cluster_name':
      return <ClusterNameStep {...stepProps} />;
    case 'connection_method':
      return <ConnectionMethodStep {...stepProps} />;
    case 'web_token':
      return <WebTokenStep {...stepProps} />;
    case 'cli':
      return <CLIStep {...stepProps} />;
    case 'trust_mode':
      return <TrustModeStep {...stepProps} />;
    case 'team_invite':
      return <TeamInviteStep {...stepProps} />;
    case 'awaiting_scan':
      return <AwaitingScanStep {...stepProps} />;
    case 'celebration':
      return <CelebrationStep {...stepProps} />;
    default:
      return null;
  }
}
