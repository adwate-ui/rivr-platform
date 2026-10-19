import { consoleApp, tv, registerMessages } from '@rivr/i18n';

// The console app's copy, with the shared copy t() always has: imported first by the app and by its tests (#344).
registerMessages({ console: consoleApp, tv });
