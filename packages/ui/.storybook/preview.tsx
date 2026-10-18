import { I18nProvider } from '@rivr/i18n';
import type { Decorator, Preview } from '@storybook/react-vite';
import { themes } from 'storybook/theming';
import '../src/styles.css';

/** Wraps every story in the app's copy, so components that read `t` show real strings. */
const withCopy: Decorator = (Story) => (
  <I18nProvider locale="en">
    <Story />
  </I18nProvider>
);

const preview: Preview = {
  decorators: [withCopy],
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
