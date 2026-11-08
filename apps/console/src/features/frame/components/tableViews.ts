import { clubDay } from '@rivr/domain/clubDay';
import { isViewKey, type TableViewStore, type ViewWire } from '@rivr/ui';
import { defaultParseSearch, defaultStringifySearch, useRouter, useRouterState, type AnyRouter } from '@tanstack/react-router';

// Any origin will do: only a link's path and search are read from it.
const ORIGIN = 'https://console.invalid';

/** The address's search with one key set, or taken off when the value is none. */
function withKey(search: object, key: string, value: ViewWire | undefined): Record<string, unknown> {
  const rest = Object.fromEntries(Object.entries(search).filter(([one]) => one !== key));
  return value === undefined ? rest : { ...rest, [key]: value };
}

/** The address as it is this moment: its path and search, which the router's state reaches only once loaded. */
function addressNow(router: AnyRouter): { readonly pathname: string; readonly search: Record<string, unknown> } {
  const { pathname, search } = router.history.location;
  return { pathname, search: defaultParseSearch(search) };
}

/**
 * Where the console's tables keep their views (owner, 9 Nov): the address, under `t.<table>`, so a filtered list
 * survives opening a row, Back, a reload and a shared link; date filters count the club's days. A write reads the
 * address as it is then and replaces it, so it never undoes a row opened meanwhile, nor adds a step to Back.
 */
export function useAddressTableViews(): TableViewStore {
  const router = useRouter();
  // Drawn again as the address changes, so every table reads its view anew.
  useRouterState({ select: (state) => state.location.href });
  return {
    read: (key) => Reflect.get(addressNow(router).search, key),
    write: (key, wire) => {
      const { pathname, search } = addressNow(router);
      void router.navigate({ href: `${pathname}${defaultStringifySearch(withKey(search, key, wire))}`, replace: true, resetScroll: false });
    },
    dayOf: clubDay,
  };
}

/**
 * A screen's own link, as a row opening its record, keeping its tables' views and any of `keys` (a list's own search),
 * so the list stays as it was filtered; a link to another screen keeps nothing.
 */
export function useNavigateKeepingViews(keys: readonly string[] = []): (href: string) => void {
  const router = useRouter();
  return (href) => {
    const { pathname, search } = addressNow(router);
    const link = new URL(href, ORIGIN);
    const own = Object.fromEntries(link.searchParams);
    // The link's own keys first, as the address read before (`?member=…`), then what is kept that the link does not set.
    const kept = link.pathname === pathname ? Object.entries(search).filter(([key]) => (isViewKey(key) || keys.includes(key)) && !(key in own)) : [];
    void router.navigate({ href: `${link.pathname}${defaultStringifySearch({ ...own, ...Object.fromEntries(kept) })}` });
  };
}
