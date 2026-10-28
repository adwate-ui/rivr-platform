import './messages.ts';
import '@rivr/ui/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OfflineStart } from './features/offline-start/index.ts';

// The page the APK shows when the hosted bundle cannot load at start (#292). It comes from the APK, so it needs no
// network; it has no client and no router.
const container = document.getElementById('root');
if (!container) throw new Error('offline.html has no #root element');

createRoot(container).render(
  <StrictMode>
    <OfflineStart shellUrl={import.meta.env.VITE_SHELL_URL} />
  </StrictMode>,
);
