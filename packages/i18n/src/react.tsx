import { t, type Translate } from './translate.ts';

/**
 * The message lookup in a component: `const t = useT(); t('common.retry')`. RIVR is English
 * only (#186), so this is `t` itself; the next part of #186 replaces every call with `t`.
 */
export function useT(): Translate {
  return t;
}
