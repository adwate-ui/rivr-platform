// First: it listens for errors from the moment it loads, so one thrown while the modules below load is kept (decision 0673).
import { ReportingVenue, reportFailure, startErrorReporting } from './features/error-reporting/index.ts';
import './messages.ts';
import '@rivr/ui/styles.css';
import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { routePatternOf } from '@rivr/error-reporting';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './router.tsx';

// Errors reach Sentry where the build names its address (#1004); in any other build nothing is kept, loaded or sent.
startErrorReporting(() => routePatternOf(router));

const client = createRivrClient({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});

const container = document.getElementById('root');
if (!container) throw new Error('index.html has no #root element');

createRoot(container).render(
  <StrictMode>
    <RivrDataProvider client={client} onFailure={reportFailure}>
      <ReportingVenue />
      <RouterProvider router={router} />
    </RivrDataProvider>
  </StrictMode>,
);
