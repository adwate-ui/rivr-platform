import { createRoute } from '@tanstack/react-router';
import { SettingsScreen } from '../features/settings/index.ts';
import { frameRoute } from './frame.tsx';

/** Every effective-dated setting, the venue configuration and the chips (#33). */
export const settingsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/settings', component: SettingsScreen });
