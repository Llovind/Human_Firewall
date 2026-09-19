export const AUTH_SESSION_COOKIE = 'afferent_session';

export function shouldUseSecureCookies(): boolean {
  const configured = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  const environment = (process.env.APP_ENV || process.env.NODE_ENV || 'development')
    .trim()
    .toLowerCase();
  return !['development', 'dev', 'local', 'test'].includes(environment);
}

export const ROLE_ROUTES: Record<string, string> = {
  employee: '/',
  phishing_admin: '/dashboard/phishing-admin',
  soc: '/dashboard/soc',
  grc: '/dashboard/grc',
  ciso: '/dashboard/ciso',
};
