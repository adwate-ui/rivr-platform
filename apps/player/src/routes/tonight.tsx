import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { frameRoute } from './frame.tsx';

// Profile's offer of seat-ready push (F3-26), read only for a member with a place, so Home does not wait for Profile.
const SeatReadyOffer = lazy(() => import('../features/profile/index.ts').then(({ SeatReadyOffer: offer }) => ({ default: offer })));

/**
 * Home: tonight at the club, composed from features/home, the waitlist's parts in features/waitlist (#273) and, once the
 * member has a place, Profile's offer of seat-ready push (F3-26), so no feature imports another. Loaded when first opened,
 * so it does not count against the initial JavaScript budget.
 */
async function loadHome() {
  const [{ HomeScreen }, { FloorList, YourWaitlist }] = await Promise.all([import('../features/home/index.ts'), import('../features/waitlist/index.ts')]);
  return {
    default: function Home() {
      return (
        <HomeScreen
          yourWaitlist={(places) => (
            <>
              <YourWaitlist places={places} />
              {places.length > 0 ? <Suspense fallback={null}><SeatReadyOffer /></Suspense> : null}
            </>
          )}
          floor={(tables, places) => <FloorList tables={tables} places={places} />} />
      );
    },
  };
}

export const tonightRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/',
  component: lazyRouteComponent(loadHome),
});
