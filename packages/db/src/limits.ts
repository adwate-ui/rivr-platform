// How many rows a list read may bring (redesign RD-31): no read in this package comes without a limit or a page. A list
// that can grow past these is read a page at a time instead (lists.ts, membersList.ts).

/** The most rows any list read brings: what the API itself gives at once. */
export const LIST_MOST = 1000;

/** A venue's staff, and those removed from it: a club's team is tens of people. */
export const STAFF_MOST = 500;

/** A venue's promotions with their versions, live, scheduled and ended. */
export const PROMOTIONS_MOST = 200;

/** A venue's menu: every item on offer or hidden. */
export const MENU_MOST = 500;

/** Joins asking the floor from the app, across every table's list. */
export const WAITLIST_REQUESTS_MOST = 200;
