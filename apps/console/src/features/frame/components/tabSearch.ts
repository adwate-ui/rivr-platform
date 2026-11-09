/**
 * A screen's tab in its address (#605): `?tab=mis` as given, so a refresh, Back or a shared link opens it. Each route
 * with tabs validates its search with this; the screen opens its first tab for a name it does not have.
 */
export function tabSearchFrom(search: Record<string, unknown>): { tab?: string } {
  const tab = search['tab'];
  return typeof tab === 'string' ? { tab } : {};
}

/** The old addresses whose tab is gone (#811): each lands on the screen that took its place, saying so in a line. */
export const MOVED_NOTICES = ['rake', 'cameras', 'computers', 'gamesHistory'] as const;

export type MovedNotice = (typeof MOVED_NOTICES)[number];

/** The search of a screen that holds others by tab (console v3). */
export interface ScreenSearch {
  /** The screen's tab: `/door?tab=players`. */
  tab?: string;
  /** An old address that moved here, said in a line above the tab. */
  notice?: MovedNotice;
}

/** Validates the search of a screen that holds others by tab: its tab and any notice. */
export function screenSearchFrom(search: Record<string, unknown>): ScreenSearch {
  const { tab } = search;
  const notice = MOVED_NOTICES.find((one) => one === search['notice']);
  return {
    ...(typeof tab === 'string' ? { tab } : {}),
    ...(notice === undefined ? {} : { notice }),
  };
}
