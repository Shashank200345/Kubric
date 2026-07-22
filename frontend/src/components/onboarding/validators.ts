/**
 * Validation utilities for the user onboarding wizard.
 * Validates: Requirements 2.2, 2.3, 5.2, 7.2
 */

/**
 * Validates a cluster name against Kubernetes naming conventions.
 * Must be 3-63 characters, lowercase alphanumeric and hyphens only,
 * and must not start or end with a hyphen.
 */
export function validateClusterName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length === 0) {
    return { valid: false, error: 'Cluster name is required' };
  }

  if (name.length < 3) {
    return { valid: false, error: 'Cluster name must be at least 3 characters' };
  }

  if (name.length > 63) {
    return { valid: false, error: 'Cluster name must be at most 63 characters' };
  }

  if (name.startsWith('-')) {
    return { valid: false, error: 'Cluster name must not start with a hyphen' };
  }

  if (name.endsWith('-')) {
    return { valid: false, error: 'Cluster name must not end with a hyphen' };
  }

  if (/[A-Z]/.test(name)) {
    return { valid: false, error: 'Cluster name must be lowercase' };
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)) {
    return { valid: false, error: 'Cluster name must contain only lowercase alphanumeric characters and hyphens' };
  }

  return { valid: true };
}

/**
 * Validates an email address for standard syntax.
 * Checks for a non-empty local part, @, and a domain with at least one dot.
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Returns the OS-specific CLI install command for the kubric CLI.
 * Defaults to the Linux command for unknown OS identifiers.
 */
export function getCliInstallCommand(os: string): string {
  const normalized = os.toLowerCase();

  if (normalized === 'macos' || normalized === 'darwin') {
    return 'brew install kubric';
  }

  if (normalized === 'windows') {
    return 'scoop install kubric';
  }

  // Linux and any unknown OS default to the curl-based command
  return 'curl -sSL https://get.kubric.dev | sh';
}
