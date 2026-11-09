import { createRoute } from '@tanstack/react-router';
import { TabletsSection, TvsSection } from '../features/devices/index.ts';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { SETTINGS_PANES } from '../features/settings/index.ts';
import { frameRoute } from './frame.tsx';

/**
 * Settings (#33, #604; console v3): one row of tabs, the settings' areas then the kinds of device (`?tab=floor|tvs`, audit
 * F-028). Games history is retired: Reports, Tables shows each table's runs (the owner, 9 Nov).
 */
export const settingsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/settings', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="settings" panes={{ ...SETTINGS_PANES, tvs: TvsSection, tablets: TabletsSection }} />,
});
