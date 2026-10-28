import { createRoute } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { SettingsScreen } from '../features/settings/index.ts';
import { frameRoute } from './frame.tsx';

/** Every effective-dated setting by area (`?tab=`), the venue configuration and the chips (#33, #604). */
export const settingsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/settings', component: SettingsScreen, validateSearch: tabSearchFrom,
});
