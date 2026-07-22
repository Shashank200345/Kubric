/**
 * TypeScript types and constants for the user onboarding wizard.
 * Validates: Requirements 1.3, 11.1
 */

// --- Types ---

export type OnboardingStep =
  | 'welcome'
  | 'cluster_name'
  | 'connection_method'
  | 'web_token'
  | 'cli'
  | 'trust_mode'
  | 'team_invite'
  | 'awaiting_scan'
  | 'celebration';

export interface OnboardingState {
  id: string;
  userId: string;
  currentStep: OnboardingStep;
  clusterName: string | null;
  connectionMethod: 'web_token' | 'cli' | null;
  trustMode: 'suggest' | 'approve' | 'auto';
  invitedEmails: string[];
  completedSteps: OnboardingStep[];
  stepTimestamps: Record<string, string>;
  isComplete: boolean;
  skipped: boolean;
}

export interface WizardState {
  currentStep: OnboardingStep;
  clusterName: string | null;
  connectionMethod: 'web_token' | 'cli' | null;
  trustMode: 'suggest' | 'approve' | 'auto';
  invitedEmails: string[];
  completedSteps: OnboardingStep[];
}

export interface StepProps {
  wizardState: WizardState;
  updateState: (partial: Partial<WizardState>) => void;
  next: () => void;
  back: () => void;
}

// --- Constants ---

export const ONBOARDING_STEPS: { id: OnboardingStep; label: string }[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'cluster_name', label: 'Name Your Cluster' },
  { id: 'connection_method', label: 'Choose Connection Method' },
  { id: 'web_token', label: 'Connect via Web Token' },
  { id: 'cli', label: 'Connect via CLI' },
  { id: 'trust_mode', label: 'Select Trust Mode' },
  { id: 'team_invite', label: 'Invite Team' },
  { id: 'awaiting_scan', label: 'Awaiting First Scan' },
  { id: 'celebration', label: 'Setup Complete' },
];

export const EMPTY_STATE_SCREENS: Record<string, string> = {
  overview:
    'Get a real-time overview of your cluster health, incidents, and workloads once you connect a cluster.',
  incidents:
    'Kubric will automatically detect and surface Kubernetes incidents once your cluster agent is connected.',
  prrisk:
    'See pull request risk analysis powered by AI when your cluster is connected and integrated with your Git provider.',
  workloads:
    'View all deployments, stateful sets, and daemon sets across your connected clusters.',
  nodes:
    'Monitor node health, resource utilization, and scheduling capacity across your cluster.',
  playbooks:
    'Create and manage automated response playbooks that trigger when specific incidents are detected.',
  ask:
    'Ask Kubric anything about your cluster — troubleshoot issues, get explanations, or request fixes in natural language.',
};
