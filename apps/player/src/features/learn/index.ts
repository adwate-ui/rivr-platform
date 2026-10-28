import { lazy } from 'react';

export { LearnScreen } from './components/LearnScreen.tsx';

/** A title's screens carry the drill engine, so they load apart from the library, when a title is opened. */
export const BookScreen = lazy(() => import('./components/BookScreen.tsx').then((module) => ({ default: module.BookScreen })));
