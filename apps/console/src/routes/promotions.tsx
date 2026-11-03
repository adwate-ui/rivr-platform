import { createRoute, useNavigate } from '@tanstack/react-router';
import { PromotionsScreen } from '../features/promotions/index.ts';
import { frameRoute } from './frame.tsx';

/** `?open=new` or `?open=<promotion id>`; nothing for the list. */
function openSearch(search: Record<string, unknown>): { open?: string } {
  const open = search['open'];
  return typeof open === 'string' && open !== '' ? { open } : {};
}

function PromotionsPage() {
  const { open } = promotionsRoute.useSearch();
  const navigate = useNavigate();
  return <PromotionsScreen open={open} onOpen={(next) => void navigate({ href: next === null ? '/promotions' : `/promotions?open=${encodeURIComponent(next)}` })} />;
}

/** Promotions (console v3): the list, the builder and the approver's view, each in the address (`?open=`). */
export const promotionsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/promotions', validateSearch: openSearch, component: PromotionsPage });
