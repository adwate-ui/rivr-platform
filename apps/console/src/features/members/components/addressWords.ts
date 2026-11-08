import { defaultParseSearch, defaultStringifySearch, useRouter, useRouterState } from '@tanstack/react-router';
import { useReducer } from 'react';

/**
 * A list's own words kept in the address under `key` (owner, 9 Nov): read from the address as it is, so a reload, a link
 * and Back all show theirs, and written there as chosen, replaced rather than added to Back.
 */
export function useAddressWords(key: string): readonly [string, (words: string) => void] {
  const router = useRouter();
  // Drawn again as the address changes (Back, a link), and as words are chosen here.
  useRouterState({ select: (state) => state.location.href });
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const kept: unknown = Reflect.get(defaultParseSearch(router.history.location.search), key);
  const words = typeof kept === 'string' || typeof kept === 'number' ? String(kept) : '';
  const keep = (next: string) => {
    const { pathname, search } = router.history.location;
    const rest = Object.fromEntries(Object.entries(defaultParseSearch(search)).filter(([one]) => one !== key));
    void router.navigate({ href: `${pathname}${defaultStringifySearch(next === '' ? rest : { ...rest, [key]: next })}`, replace: true, resetScroll: false });
    redraw();
  };
  return [words, keep] as const;
}
