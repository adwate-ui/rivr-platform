import '@rivr/ui/styles.css';
import { createRivrClient, rememberAttribution, RivrDataProvider } from '@rivr/db';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { startInstallWatch, takeUpdateWhenHidden } from './features/frame/index.ts';
import { router } from './router.tsx';

// The codes of the link the app opened with, kept until sign-up (#10).
rememberAttribution(window.location.search);

// The installed app (#16): this visit counted for the install offer, its prompt kept when it comes,
// and the service worker that keeps the shell for opening offline. An app left open seldom loads a
// page, so it asks for a new version every hour. One that arrives waits until the page is out of
// sight, then takes over and reloads it (#252); a closed app opens on it anyway.
const HOUR = 60 * 60 * 1000;
startInstallWatch();
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => takeUpdateWhenHidden(() => void updateSW(true)),
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
    <RivrDataProvider client={client}>
      <RouterProvider router={router} />
    </RivrDataProvider>
  </StrictMode>,
);
