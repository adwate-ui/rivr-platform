import { addons } from 'storybook/manager-api';
import { themes } from 'storybook/theming';

// The design system is dark only, so its reference is too.
addons.setConfig({ theme: themes.dark });
