import { HANDLED, type Kept } from './kept.ts';
import type { SentryOptions } from './sentry.ts';

/** What error reporting is started with: the app's name and version, and how to read the open route's pattern. */
export type ErrorReportingOptions = Omit<SentryOptions, 'dsn'> & {
  /** The open route's pattern, such as `/sessions/$sessionId`: never the address, which holds ids. */
  readonly route: () => string;
};

// The Sentry project's address, from the build (#928, decision 0604). A build that names none keeps nothing, loads
// nothing and sends nothing.
let dsn = import.meta.env.VITE_SENTRY_DSN;
// Errors wait here until Sentry has loaded and the venue is known. A few are enough to find a fault; a loop of them is not kept.
const LIMIT = 10;
const waiting: Kept[] = [];
const told = new Set<string>();
let route = (): string => '';
let isPractice: boolean | null = false;
let isStarted = false;
let send = (): void => undefined;

function keep(error: unknown, isCaught: boolean): void {
  // A script from another site that fails gives no error to report.
  if (!dsn || error === null || error === undefined || waiting.length >= LIMIT) return;
  waiting.push({ error, isCaught, route: route() });
  send();
}

// Listening starts as this module loads, before the app's own: a failure while the app starts is kept too.
if (dsn) {
  window.addEventListener('error', (event) => keep(event.error, false));
  window.addEventListener('unhandledrejection', (event) => keep(event.reason, false));
}

/** Reports an error the app caught itself, such as a screen that failed to draw. */
export function reportError(error: unknown): void {
  keep(error, true);
}

/** Reports a failure a screen handled itself, by its short code and never a typed value; each code once a visit. */
export function reportFailure(code: string): void {
  if (told.has(code)) return;
  told.add(code);
  keep(Object.assign(new Error(code), { name: HANDLED }), true);
}

/** Whose venue this is: the practice one (true) sends nothing; one not yet known (null) holds what happens; else it is sent. */
export function setPracticeVenue(value: boolean | null): void {
  isPractice = value;
  send();
}

// After the next frame is drawn, so Sentry is no part of what the first screen waits for.
const afterFirstPaint = (run: () => void) => requestAnimationFrame(() => setTimeout(run, 0));

/** Loads Sentry after the first paint, to stay out of the initial JavaScript; what happened before then was kept for it. */
export function startErrorReporting({ route: routeNow, ...options }: ErrorReportingOptions): void {
  const address = dsn;
  if (!address || isStarted) return;
  isStarted = true;
  route = routeNow;
  afterFirstPaint(() => {
    void import('./sentry.ts').then(
      ({ startSentry }) => {
        send = startSentry({ ...options, dsn: address }, waiting, () => isPractice);
        send();
      },
      // Sentry could not be fetched, as with no connection: there is nowhere to report to, so nothing more is kept.
      () => {
        dsn = undefined;
        waiting.length = 0;
      },
    );
  });
}
