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

/**
 * The end of the title row of the Screen whose tabs hold this one, where a part's actions and Export stand, so a tab's
 * create button sits beside the title rather than on a row of its own (audit F-028, F-119). Null outside tabs.
 */
export const ScreenTitleSlotContext = createContext<HTMLElement | null>(null);
