import { createContext, use } from 'react';

/**
 * True inside a ConsoleShell (console v3): below 768 px its header names the screen, so a screen's own h1 is heard there
 * but not shown again. False in every other app.
 */
export const ConsoleFrameContext = createContext(false);

/** Whether this screen sits in the console's shell. */
export function useIsInConsole(): boolean {
  return use(ConsoleFrameContext);
}

/**
 * True inside a Screen's `tabs`: a screen shown as one tab of another is a part of it, its title heard as an h2 but not
 * shown, since the screen's title and the tab already name it (console v3).
 */
export const ScreenPartContext = createContext(false);
