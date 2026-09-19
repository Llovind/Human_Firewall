const environment = (
  process.env.APP_ENV || process.env.NODE_ENV || 'development'
).trim().toLowerCase();

const nonLocal = new Set(['staging', 'production', 'prod']);
const bypassEnabled = ['1', 'true', 'yes', 'on'].includes(
  (process.env.DEV_BYPASS_AUTH || '').trim().toLowerCase(),
);

if (nonLocal.has(environment) && bypassEnabled) {
  throw new Error(
    `Refusing to start: DEV_BYPASS_AUTH must be disabled when APP_ENV=${environment}`,
  );
}

if (nonLocal.has(environment) && !process.env.SERVICE_API_KEY) {
  throw new Error(
    `Refusing to start: SERVICE_API_KEY is required when APP_ENV=${environment}`,
  );
}
