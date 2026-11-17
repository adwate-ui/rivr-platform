import { createRoute } from '@tanstack/react-router';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { AppContentScreen, WebsiteScreen } from '../features/website/index.ts';
import { frameRoute } from './frame.tsx';

/** Content (console v3): the website (`?tab=website`) and the player app's words the club writes (`?tab=app`, #1065). */
export const contentRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/content', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="content" panes={{ website: WebsiteScreen, app: AppContentScreen }} />,
});
