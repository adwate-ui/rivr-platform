import { createErrorReporting } from '@rivr/error-reporting';

// The player's error reporting (#928, decisions 0604, 0672 and 0673), made as this module loads, which main.tsx imports
// first: it listens from that moment. A build that names no address keeps nothing, loads nothing and sends nothing.
const reporting = createErrorReporting({
  dsn: import.meta.env.VITE_SENTRY_DSN_PLAYER,
  app: 'player',
  version: import.meta.env.VITE_APP_VERSION,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  scriptsAt: '/assets/',
});

export const { reportError, reportFailure, setPracticeVenue, start: startErrorReporting } = reporting;
