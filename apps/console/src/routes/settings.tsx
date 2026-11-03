import { createRoute } from '@tanstack/react-router';
import { DevicesScreen } from '../features/devices/index.ts';
import { tabSearchFrom } from '../features/frame/index.ts';
import { GamesHistoryScreen } from '../features/games-history/index.ts';
import { SettingsScreen } from '../features/settings/index.ts';
import { frameRoute } from './frame.tsx';

/**
 * Settings (console v3), its parts as tabs: every effective-dated setting by area, the venue configuration and notices
 * (#33, #604); the TVs and tablets (#606); and the games run (#643). `?tab=` names a part or a place in one: an area
 * (`club`), a kind of device (`tvs`, `tablets`) or `history`.
 */
function SettingsRoute() {
  const { tab } = settingsRoute.useSearch();
  return <SettingsScreen tab={tab} devices={<DevicesScreen tab={tab} />} gamesHistory={<GamesHistoryScreen />} />;
}

export const settingsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/settings', component: SettingsRoute, validateSearch: tabSearchFrom,
});
