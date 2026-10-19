import { tabletApp, tv, registerMessages } from '@rivr/i18n';

// The tablet app's copy, with the shared copy t() always has: imported first by the app and by its tests (#344).
registerMessages({ tablet: tabletApp, tv });
