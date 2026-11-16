import {
  breadcrumbsIntegration, captureException, dedupeIntegration, eventFiltersIntegration, getClient, httpContextIntegration, init,
  linkedErrorsIntegration, type Event as SentryEvent, type EventHint,
} from '@sentry/react';
import { HANDLED, type Kept } from './kept.ts';
import { scrubBreadcrumb, scrubEvent, type EventKind } from './scrub.ts';

/** What Sentry is started with (decision 0604). */
export interface SentryOptions {
  /** The app's Sentry address, from its build (`VITE_SENTRY_DSN_PLAYER` and so on). */
  readonly dsn: string;
  /** Where the app's own scripts are served, such as `/assets/` (a Vite app) or `/_astro/` (the website): only their errors are sent. */
  readonly scriptsAt: string;
  /** The app the error is from, sent as a tag. */
  readonly app: string;
  /** The build's version (`VITE_APP_VERSION`), sent as the release; none in a build that does not name it. */
  readonly version: string | undefined;
  /** The deploy, `staging` or `production` (`VITE_SENTRY_ENVIRONMENT`); Sentry's default in a build that does not name it. */
  readonly environment: string | undefined;
}

// Every kind of data the SDK would collect by itself, off: no user or IP address, no cookies, no request or response
// bodies, no query strings, no local values. Of the headers only the browser's name is asked for.
const NEITHER = { inputs: false, outputs: false };
const COLLECT_NOTHING = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: NEITHER,
  mcp: NEITHER,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 0,
};

// A thrown string or number is `value`: its words are any words at all, so none are sent. A failure a screen handled is told by its name.
function kindOf(thrown: unknown): EventKind {
  if (thrown instanceof Error) return thrown.name === HANDLED ? 'handled' : 'error';
  return typeof thrown === 'object' && thrown !== null ? 'error' : 'value';
}

// The route's pattern as it was when the error happened, kept with it (./errorReporting.ts).
function routeOf(hint: EventHint): string {
  const route: unknown = hint.data?.route;
  return typeof route === 'string' ? route : '';
}

/**
 * Starts Sentry for errors only and returns how to send what is waiting. No tracing, logs, replay, feedback or sessions,
 * and no listener of its own: every error comes through `waiting`, so each is held while the venue is not known, dropped
 * in the practice venue, and goes through ./scrub.ts before it leaves.
 */
export function startSentry({ dsn, app, version, environment, scriptsAt }: SentryOptions, waiting: Kept[], isPractice: () => boolean | null): () => void {
  const scrubbed = <Sent extends SentryEvent>(event: Sent, hint: EventHint): Sent => scrubEvent(event, { app, route: routeOf(hint) }, kindOf(hint.originalException));
  init({
    dsn,
    ...(version ? { release: version } : {}),
    ...(environment ? { environment } : {}),
    // Each integration is named, so one a later SDK turns on by default (console lines, sessions, clicks) collects nothing here.
    defaultIntegrations: false,
    integrations: [
      eventFiltersIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      httpContextIntegration(),
      // Requests and moves between screens only: a click's breadcrumb carries the words on the button, which may be a name.
      breadcrumbsIntegration({ dom: false, sentry: false }),
    ],
    dataCollection: COLLECT_NOTHING,
    // Only errors thrown from the app's own scripts: not a browser extension's, nor a script an in-app browser adds.
    allowUrls: [`${window.location.origin}${scriptsAt}`],
    maxValueLength: 1000,
    // A failed request's host is added to the copy of the error that is sent, never to the app's own.
    enhanceFetchErrorMessages: 'report-only',
    sendClientReports: false,
    maxBreadcrumbs: 30,
    // A breadcrumb is kept only while the venue is known not to be the practice one, so a staff member who switches from it
    // to the club carries none of it into the club's first report.
    beforeBreadcrumb: (breadcrumb) => (isPractice() === false ? scrubBreadcrumb(breadcrumb) : null),
    // The practice venue never reaches a vendor: a second lock behind the one below.
    beforeSend: (event, hint) => (isPractice() === false ? scrubbed(event, hint) : null),
  });
  // Scrubbed once more as it leaves: an event the SDK makes of its own failure skips beforeSend.
  getClient()?.on('beforeSendEvent', (event, hint = {}) => {
    const again = scrubbed(event, hint);
    for (const key of Object.keys(event)) Reflect.deleteProperty(event, key);
    Object.assign(event, again);
  });
  return () => {
    const practice = isPractice();
    if (practice === null) return;
    for (const { error, isCaught, route } of waiting.splice(0)) {
      if (!practice) captureException(error, { mechanism: { handled: isCaught, type: 'generic' }, data: { route } });
    }
  };
}
