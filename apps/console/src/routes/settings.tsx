import { createRoute } from '@tanstack/react-router';
import { DevicesScreen } from '../features/devices/index.ts';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { SettingsScreen } from '../features/settings/index.ts';
import { frameRoute } from './frame.tsx';

/**
 * Settings (#33, #604; console v3): the settings and the devices, by tab (`?tab=settings|devices`); a tab's own parts, a
 * settings area or a kind of device, by `?part=`. Games history is retired: Reports, Tables shows each table's runs (the
 * owner, 9 Nov).
 */
export const settingsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/settings', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="settings" panes={{ settings: SettingsScreen, devices: DevicesScreen }} />,
});
