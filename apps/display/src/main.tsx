import './messages.ts';
import '@rivr/ui/styles.css';
import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './router.tsx';

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
