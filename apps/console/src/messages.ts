import { consoleApp, documents, tv, registerMessages } from '@rivr/i18n';

// The console app's copy, with the shared copy t() always has: imported first by the app and by its tests (#344).
// The cage's receipts use the printed documents' copy (#69).
registerMessages({ console: consoleApp, tv, documents });
