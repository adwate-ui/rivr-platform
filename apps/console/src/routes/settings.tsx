import { createRoute } from '@tanstack/react-router';
import { DevicesScreen } from '../features/devices/index.ts';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { GamesHistoryScreen } from '../features/games-history/index.ts';
import { SettingsScreen } from '../features/settings/index.ts';
import { frameRoute } from './frame.tsx';

/**
 * Settings (#33, #604; console v3): the settings, the devices and the games history, by tab
 * (`?tab=settings|devices|games-history`); a tab's own parts, a settings area or a kind of device, by `?part=`.
 */
export const settingsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/settings', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="settings" panes={{ settings: SettingsScreen, devices: DevicesScreen, 'games-history': GamesHistoryScreen }} />,
});
