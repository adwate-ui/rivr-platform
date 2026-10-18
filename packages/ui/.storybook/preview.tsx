import { I18nProvider, type Locale } from '@rivr/i18n';
import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect, type ReactNode } from 'react';
import { themes } from 'storybook/theming';
import '../src/styles.css';

/** Sets the document language so screen readers and the a11y checks read Hindi as Hindi. */
function DocumentLanguage({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <I18nProvider locale={locale}>{children}</I18nProvider>;
}

/** Wraps every story in the language picked in the toolbar, or the one the story fixes. */
const withLocale: Decorator = (Story, context) => (
  <DocumentLanguage locale={context.globals.locale === 'hi' ? 'hi' : 'en'}>
    <Story />
  </DocumentLanguage>
);

const preview: Preview = {
  decorators: [withLocale],
  globalTypes: {
    locale: {
      description: 'Language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'hi', title: 'हिन्दी' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: 'en' },
  parameters: {
    layout: 'padded',
    // The controls panel serialises args as JSON, which cannot hold bigint paise or the
    // elements passed into slots, so those args have no control.
    controls: { exclude: /^(children|actions|banner|footer|corner|paise|smallBlind|bigBlind)$/ },
    // RIVR is dark only; the page background comes from the stylesheet, not the addon.
    backgrounds: { disable: true },
    docs: { theme: themes.dark },
    a11y: { test: 'error' },
  },
};

export default preview;
