// First: it listens for errors from the moment it loads, so one thrown while the modules below load is kept (decision 0604).
import { ReportingVenue, reportFailure, startErrorReporting } from './features/error-reporting/index.ts';
import './messages.ts';
import '@rivr/ui/styles.css';
import { createRivrClient, rememberAttribution, RivrDataProvider } from '@rivr/db';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { startInstallWatch, takeUpdateWhenHidden, takeWaitingUpdateAtNewScreens, watchLaunch } from './features/frame/index.ts';
import { routePatternOf, router } from './router.tsx';

// Errors reach Sentry where the build names its address (#928); in any other build nothing is kept, loaded or sent.
startErrorReporting({
  app: 'player',
  version: import.meta.env.VITE_APP_VERSION,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  route: () => routePatternOf(router),
});

// The codes of the link the app opened with, kept until sign-up (#10).
rememberAttribution(window.location.search);

// The installed app (#16): this visit counted for the install offer, its prompt kept when it comes,
// and the service worker that keeps the shell for opening offline. An app left open seldom loads a
// page, so it asks for a new version every hour. One that arrives waits until the page is out of
// sight, then takes over and reloads it (#252); a closed app opens on it anyway. A phone that opens
// the app after days starts on the copy it kept: the new one is taken as the app starts, before
// the first touch or key, or at the next screen (the trial run, 13 Nov).
const HOUR = 60 * 60 * 1000;
startInstallWatch();
watchLaunch();
takeWaitingUpdateAtNewScreens(router);
// Reloaded here, not by the plugin: it reloads only a page a worker already served when it loaded,
// and a first visit (an iPhone Home Screen app's first launch) would keep the old code.
const reloadOnNewWorker = () => {
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  void updateSW(true);
};
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => takeUpdateWhenHidden(reloadOnNewWorker),
  // Another window took the new version: this one waits too, until it is out of sight.
  onNeedReload: () => takeUpdateWhenHidden(() => window.location.reload()),
  onRegisteredSW: (_url, registration) => {
    if (registration) setInterval(() => void registration.update(), HOUR);
  },
});

const client = createRivrClient({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});

const container = document.getElementById('root');
if (!container) throw new Error('index.html has no #root element');

createRoot(container).render(
  <StrictMode>
    <RivrDataProvider client={client} keepsForOffline onFailure={reportFailure}>
      <ReportingVenue />
      <RouterProvider router={router} />
    </RivrDataProvider>
  </StrictMode>,
);
