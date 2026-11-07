import { createRoute, useNavigate } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { PromotionsScreen } from '../features/promotions/index.ts';
import { frameRoute } from './frame.tsx';

/** `?open=new` or `?open=<promotion id>`; nothing for the list, whose Ended tab is `?tab=ended` (owner, 8 Nov). */
function openSearch(search: Record<string, unknown>): { open?: string; tab?: string } {
  const open = search['open'];
  return { ...(typeof open === 'string' && open !== '' ? { open } : {}), ...tabSearchFrom(search) };
}

function PromotionsPage() {
  const { open, tab } = promotionsRoute.useSearch();
  const navigate = useNavigate();
  return (
    <PromotionsScreen open={open} tab={tab} onNavigate={(href) => void navigate({ href })}
      onOpen={(next) => void navigate({ href: next === null ? '/promotions' : `/promotions?open=${encodeURIComponent(next)}` })} />
  );
}

/** Promotions (console v3): the list by tab, the builder and the approver's view, each in the address (`?tab=`, `?open=`). */
export const promotionsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/promotions', validateSearch: openSearch, component: PromotionsPage });
