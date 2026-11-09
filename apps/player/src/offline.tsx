import './messages.ts';
import '@rivr/ui/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OfflineStart } from './features/offline-start/index.ts';

// The page the store app shows when the hosted app cannot load at start (decision 0577). It comes from the app, so it needs
// no network; it has no client and no router.
const container = document.getElementById('root');
if (!container) throw new Error('offline.html has no #root element');

createRoot(container).render(
  <StrictMode>
    <OfflineStart shellUrl={import.meta.env.VITE_SHELL_URL} />
  </StrictMode>,
);
