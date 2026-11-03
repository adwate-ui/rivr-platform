import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { tabSearchFrom } from '../features/frame/index.ts';
import { frameRoute } from './frame.tsx';

// Loaded when first opened: its Learn content tab carries the drill engine, which checks an encoding before upload.
const ContentScreen = lazy(async () => ({ default: (await import('../features/content/index.ts')).ContentScreen }));

/** Content (console v3): the Website editor and Learn content, by tab (`?tab=website`, `?tab=learn`). */
export const contentRoute = createRoute({ getParentRoute: () => frameRoute, path: '/content', validateSearch: tabSearchFrom, component: ContentRoute });

function ContentRoute() {
  const { tab } = contentRoute.useSearch();
  const navigate = useNavigate();
  return (
    <Suspense fallback={<Screen title={t('console.content.title')} status="loading" loadingLook="rows" />}>
      <ContentScreen tab={tab} onNavigate={(href) => void navigate({ href })} />
    </Suspense>
  );
}
