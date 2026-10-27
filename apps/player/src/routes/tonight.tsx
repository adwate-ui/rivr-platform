import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/**
 * Home: tonight at the club, composed from features/home and the waitlist's parts in features/waitlist (#273), so no
 * feature imports another. Loaded when first opened, so it does not count against the initial JavaScript budget.
 */
async function loadHome() {
  const [{ HomeScreen }, { FloorList, YourWaitlist }] = await Promise.all([import('../features/home/index.ts'), import('../features/waitlist/index.ts')]);
  return {
    default: function Home() {
      return <HomeScreen yourWaitlist={(places) => <YourWaitlist places={places} />} floor={(tables, places) => <FloorList tables={tables} places={places} />} />;
    },
  };
}

export const tonightRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/',
  component: lazyRouteComponent(loadHome),
});
