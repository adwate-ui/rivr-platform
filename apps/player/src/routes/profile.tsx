import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { useInstallOffer } from '../features/frame/index.ts';
import { frameRoute } from './frame.tsx';

// Loaded when first opened, so Profile does not count against the initial JavaScript budget.
const profile = () => import('../features/profile/index.ts');

/** Profile, with the frame's way to put the app on the home screen passed in (#1054), so no feature imports another. */
async function loadProfile() {
  const { ProfileScreen } = await profile();
  return {
    default: function Profile() {
      const { way, install } = useInstallOffer(true);
      return <ProfileScreen install={way === null ? null : { way, onInstall: install }} />;
    },
  };
}

/** Profile, behind the member's initial. */
export const profileRoute = createRoute({ getParentRoute: () => frameRoute, path: '/profile', component: lazyRouteComponent(loadProfile) });

/** House rules and the legal standing (#637), from Profile. */
export const houseRulesRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/profile/rules',
  component: lazyRouteComponent(profile, 'HouseRulesScreen'),
});
