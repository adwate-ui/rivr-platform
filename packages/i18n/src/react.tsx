import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Locale } from './catalogue/types.ts';
import { createTranslator, type Translate } from './translate.ts';

const LocaleContext = createContext<Locale>('en');

/** Sets the language for everything below it. Each app wraps its root in one. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** The current language. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** The translate function for the current language: `const t = useT(); t('common.retry')`. */
export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}
