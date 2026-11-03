import { createRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { WebsiteScreen } from '../features/website/index.ts';
import { frameRoute } from './frame.tsx';

// Learn content is loaded when first opened: it carries the drill engine, which checks an encoding before upload.
const LearnSourcesScreen = lazy(() => import('../features/learn-sources/index.ts').then((loaded) => ({ default: loaded.LearnSourcesScreen })));

/** Content (console v3): the website, then Learn content, by tab (`?tab=website|learn`). */
export const contentRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/content', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="content" panes={{ website: WebsiteScreen, learn: LearnSourcesScreen }} />,
});
