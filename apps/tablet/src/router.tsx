import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRouter, type ErrorComponentProps, type RouterHistory } from '@tanstack/react-router';
import { homeRoute } from './routes/home.tsx';
import { rootRoute } from './routes/root.tsx';

const routeTree = rootRoute.addChildren([homeRoute]);

/** A screen that failed to draw: the app's error screen, with Try again, in place of the router's unstyled default. */
function ScreenFailed({ reset }: ErrorComponentProps) {
  return <Screen title={t('common.screenFailed')} status="error" onRetry={reset} />;
}

/** The tablet app's router; tests pass a memory history. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, defaultErrorComponent: ScreenFailed, ...(history ? { history } : {}) });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
