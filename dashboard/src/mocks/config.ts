/**
 * Front-end-only mock mode: switches and safety guard.
 * Everything under src/mocks/ can be deleted together with its single hook in src/proxy.ts.
 */

export const ROLES = ['employee', 'phishing_admin', 'soc', 'grc', 'ciso'] as const;
export type MockRole = (typeof ROLES)[number];

/** normal = full data, empty = no records, loading = slow replies, error = failing replies. */
export const SCENARIOS = ['normal', 'empty', 'loading', 'error'] as const;
export type MockScenario = (typeof SCENARIOS)[number];

export const ROLE_COOKIE = 'afferent_mock_role';
export const SCENARIO_COOKIE = 'afferent_mock_scenario';
export const SIGNED_OUT_COOKIE = 'afferent_mock_signed_out';
export const SWITCHER_PATH = '/api/__mock';
export const LOADING_DELAY_MS = 4000;

/**
 * Mocks only run when USE_MOCKS=true AND this is a local `next dev` process.
 * A production build (`next build` / `next start`) always ignores the flag.
 */
export function mocksEnabled(): boolean {
  if (process.env.USE_MOCKS?.trim().toLowerCase() !== 'true') return false;
  if (process.env.NODE_ENV !== 'development') return false;
  const appEnv = (process.env.APP_ENV || 'local').trim().toLowerCase();
  return ['development', 'dev', 'local', 'test'].includes(appEnv);
}

export function asRole(value: string | undefined | null): MockRole {
  return (ROLES as readonly string[]).includes(value || '')
    ? (value as MockRole)
    : (asRoleFallback());
}

function asRoleFallback(): MockRole {
  const fromEnv = process.env.MOCK_ROLE?.trim();
  return (ROLES as readonly string[]).includes(fromEnv || '') ? (fromEnv as MockRole) : 'employee';
}

export function asScenario(value: string | undefined | null): MockScenario {
  return (SCENARIOS as readonly string[]).includes(value || '')
    ? (value as MockScenario)
    : 'normal';
}
