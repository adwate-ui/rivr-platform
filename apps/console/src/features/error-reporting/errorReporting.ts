import { createErrorReporting } from '@rivr/error-reporting';

// The console app's error reporting (#1004, decision 0673), made as this module loads, which main.tsx imports first: it
// listens from that moment. A build that names no address keeps nothing, loads nothing and sends nothing.
const reporting = createErrorReporting({
  dsn: import.meta.env.VITE_SENTRY_DSN_CONSOLE,
  app: 'console',
  version: import.meta.env.VITE_APP_VERSION,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  scriptsAt: '/assets/',
});

export const { reportError, reportFailure, setPracticeVenue, start: startErrorReporting } = reporting;
