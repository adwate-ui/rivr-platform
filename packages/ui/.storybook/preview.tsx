import type { Preview } from '@storybook/react-vite';
import { themes } from 'storybook/theming';
import '../src/styles.css';

const preview: Preview = {
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
