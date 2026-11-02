import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { frameRoute } from './frame.tsx';

// Profile's offer of seat-ready push (F3-26), read only for a member with a place, so Tonight does not wait for Profile.
const SeatReadyOffer = lazy(() => import('../features/profile/index.ts').then(({ SeatReadyOffer: offer }) => ({ default: offer })));

/**
 * Tonight (decision 0320): features/home, with Profile's offer of seat-ready push (F3-26) passed in by the route, so no
 * feature imports another. Loaded when first opened, so it does not count against the initial JavaScript budget.
 */
async function loadHome() {
  const { HomeScreen } = await import('../features/home/index.ts');
  return {
    default: function Home() {
      return <HomeScreen offer={<Suspense fallback={null}><SeatReadyOffer /></Suspense>} />;
    },
  };
}

/** A push's button opens Tonight with what to do (decision 0320): the Add time sheet, or "I'm on my way" to a seat call. */
interface TonightSearch {
  sheet?: 'add-time' | undefined;
  accept?: string | undefined;
}

export const tonightRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): TonightSearch => ({
    sheet: search.sheet === 'add-time' ? 'add-time' : undefined,
    accept: typeof search.accept === 'string' ? search.accept : undefined,
  }),
  component: lazyRouteComponent(loadHome),
});
