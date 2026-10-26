import { createRoute } from '@tanstack/react-router';
import { ExpensesScreen } from '../features/expenses/index.ts';
import { frameRoute } from './frame.tsx';

/** Expenses with receipts and a second person's approval (#95). */
export const expensesRoute = createRoute({ getParentRoute: () => frameRoute, path: '/expenses', component: ExpensesScreen });
