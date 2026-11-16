import { HANDLED, type Kept } from './kept.ts';
import type { SentryOptions } from './sentry.ts';

/** What an app's error reporting is made with (decisions 0604, 0672, 0673): Sentry's options, its address possibly unset. */
export type ErrorReportingOptions = Omit<SentryOptions, 'dsn'> & {
  /** The app's Sentry address, from its build. A build that names none keeps nothing, loads nothing and sends nothing. */
  readonly dsn: string | undefined;
};

/** One app's error reporting. Its parts may be passed on alone, as callbacks. */
export interface ErrorReporting {
  /** Reports an error the app caught itself, such as a screen that failed to draw. */
  readonly reportError: (error: unknown) => void;
  /** Reports a failure a screen handled itself, by its short code and never a typed value; each code once a visit. */
  readonly reportFailure: (code: string) => void;
  /** Whose venue this is: the practice one (true) sends nothing; one not yet known (null) holds what happens; else it is sent. */
  readonly setPracticeVenue: (value: boolean | null) => void;
  /** Loads Sentry after the first paint, given how to read the open route's pattern (never the address, which holds ids). */
  readonly start: (route: () => string) => void;
}

// Errors wait until Sentry has loaded and the venue is known. A few are enough to find a fault; a loop of them is not kept.
const LIMIT = 10;

interface State {
  dsn: string | undefined;
  readonly options: Omit<SentryOptions, 'dsn'>;
  readonly waiting: Kept[];
  readonly told: Set<string>;
  route: () => string;
  isPractice: boolean | null;
  isStarted: boolean;
  send: () => void;
}

function keep(state: State, error: unknown, isCaught: boolean): void {
  // A script from another site that fails gives no error to report.
  if (!state.dsn || error === null || error === undefined || state.waiting.length >= LIMIT) return;
  state.waiting.push({ error, isCaught, route: state.route() });
  state.send();
}

// After the next frame is drawn, so Sentry is no part of what the first screen waits for.
const afterFirstPaint = (run: () => void) => requestAnimationFrame(() => setTimeout(run, 0));

function start(state: State, route: () => string): void {
  const address = state.dsn;
  if (!address || state.isStarted) return;
  state.isStarted = true;
  state.route = route;
  afterFirstPaint(() => {
    void import('./sentry.ts').then(
      ({ startSentry }) => {
        state.send = startSentry({ ...state.options, dsn: address }, state.waiting, () => state.isPractice);
        state.send();
      },
      // Sentry could not be fetched, as with no connection: there is nowhere to report to, so nothing more is kept.
      () => {
        state.dsn = undefined;
        state.waiting.length = 0;
      },
    );
  });
}

/**
 * An app's error reporting (#928, decisions 0604 and 0673). It listens from the moment it is made, so an app makes it in
 * the first module its entry imports: a failure while the app starts is kept too.
 */
export function createErrorReporting({ dsn, ...options }: ErrorReportingOptions): ErrorReporting {
  const state: State = {
    dsn: dsn || undefined, options, waiting: [], told: new Set(), route: () => '', isPractice: false, isStarted: false, send: () => undefined,
  };
  if (state.dsn) {
    window.addEventListener('error', (event) => keep(state, event.error, false));
    window.addEventListener('unhandledrejection', (event) => keep(state, event.reason, false));
  }
  return {
    reportError: (error) => keep(state, error, true),
    reportFailure: (code) => {
      if (state.told.has(code)) return;
      state.told.add(code);
      keep(state, Object.assign(new Error(code), { name: HANDLED }), true);
    },
    setPracticeVenue: (value) => {
      state.isPractice = value;
      state.send();
    },
    start: (route) => start(state, route),
  };
}

/**
 * The pattern of the route a TanStack router shows, such as `/sessions/$sessionId`: never the address, which holds ids.
 * Error reports are labelled with it as it is, unscrubbed, so it must stay a pattern.
 */
export function routePatternOf(router: { readonly state: { readonly matches: readonly { readonly fullPath: string }[] } }): string {
  return router.state.matches.at(-1)?.fullPath ?? '';
}
