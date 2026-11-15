import { createRoute } from '@tanstack/react-router';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { WebsiteScreen } from '../features/website/index.ts';
import { frameRoute } from './frame.tsx';

/** Content (console v3): the website (`?tab=website`). Learn content went with Learn on 15 Nov. */
export const contentRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/content', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="content" panes={{ website: WebsiteScreen }} />,
});
