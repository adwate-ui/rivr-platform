import { createRoute } from '@tanstack/react-router';
import { FnbScreen } from '../features/fnb/index.ts';
import { frameRoute } from './frame.tsx';

/** Table-side food and drink (#123): the KOTs to print, tonight's orders, ordering for a seat, and the menu. */
export const fnbRoute = createRoute({ getParentRoute: () => frameRoute, path: '/fnb', component: FnbScreen });
