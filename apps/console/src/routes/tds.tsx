import { createRoute } from '@tanstack/react-router';
import { TdsScreen } from '../features/reports/index.ts';
import { frameRoute } from './frame.tsx';

/** The TDS withholding ledger and the quarterly return extract (#93). */
export const tdsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/tds', component: TdsScreen });
