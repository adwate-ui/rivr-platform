# @rivr/error-reporting

Error reporting to Sentry for the five web apps (#928, #1004; decisions 0604, 0672, 0673). It is the one place in the repository that posts to Sentry. `@rivr/ui` and `@rivr/db` know nothing of it: they hand an app a callback (`onFailure`, `onTrouble`).

## Public API

| Export | What it does |
|---|---|
| `createErrorReporting({ dsn, app, version, environment, scriptsAt })` | An app's reporting. Made in the first module the app's entry imports, it listens for errors nothing caught from that moment. `dsn` unset or empty: nothing is kept, Sentry is never fetched, nothing is sent. `scriptsAt` is where the app's own scripts are served (`/assets/` for a Vite app, `/_astro/` for the website): only errors thrown from them are sent. Returns `reportError`, `reportFailure` (a handled failure's short code, once a visit), `setPracticeVenue` (true sends nothing, null holds until known; breadcrumbs are kept only while it is false) and `start(route)`, which loads Sentry after the first paint. Each instance keeps its own state. |
| `routePatternOf(router)` | The pattern of the route a TanStack router shows (`/sessions/$sessionId`), never the address, which holds ids: the `route` label of each report. |
| `ErrorReporting`, `ErrorReportingOptions` | Their types. |

What is sent, what never is, and the scrubbing (`src/scrub.ts`, applied in `beforeSend` and again as an event leaves) are in decision 0604. Source maps are not here: `@rivr/config/sentry` gives each app's Vite config the upload plugin.

## Usage

In the app's `features/error-reporting/errorReporting.ts`, which `main.tsx` imports first:

```ts
import { createErrorReporting } from '@rivr/error-reporting';

const reporting = createErrorReporting({
  dsn: import.meta.env.VITE_SENTRY_DSN_CONSOLE,
  app: 'console',
  version: import.meta.env.VITE_APP_VERSION,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  scriptsAt: '/assets/',
});

export const { reportError, reportFailure, setPracticeVenue, start: startErrorReporting } = reporting;
```

Then in `main.tsx`: `startErrorReporting(() => routePatternOf(router))`, `onFailure={reportFailure}` on `RivrDataProvider`, `defaultOnCatch: reportError` on the router, and a component that calls `setPracticeVenue` with whether the venue is the practice one (each app's `ReportingVenue`).

## Must not

- Send who is signed in, typed input, page text, cookies, headers, bodies, query strings or screenshots, or turn on Session Replay, tracing, logs or feedback (decision 0604).
- Send anything from the practice venue: an app must tell it the venue, and hold (`null`) while it is not known.
- Label a report with an address: `route` is sent unscrubbed, so it must be a pattern (`routePatternOf`, or the website's `Astro.routePattern`).
- Be imported by `@rivr/ui`, `@rivr/db`, `@rivr/domain` or an Edge Function. They report through the callbacks an app gives them.
