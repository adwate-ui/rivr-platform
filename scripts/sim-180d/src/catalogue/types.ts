/** The catalogue: every screen, every database call and every workflow, so "every" can be counted. */

export type AppName = 'player' | 'console' | 'tablet' | 'door' | 'display' | 'web';

/** Who acts: a staff role, a signed-in member, a website visitor, or a paired device (TV, tablet, door kiosk). */
export type Role =
  | 'super_admin'
  | 'admin'
  | 'floor'
  | 'host'
  | 'cashier'
  | 'dealer'
  | 'marketing'
  | 'service'
  | 'owner_view'
  | 'member'
  | 'visitor'
  | 'device';

/**
 * - menu: an entry in the console's rail, opened by its address;
 * - tab: one tab of a menu entry (`/waitlist?tab=lists`);
 * - route: an address the app answers that is not in the menu (an old address, a sign-in, a detail page);
 * - hidden: in the console's HIDDEN list, or redirected away, so refused or moved for everyone.
 */
export type ScreenKind = 'menu' | 'tab' | 'route' | 'hidden';

export interface Screen {
  app: AppName;
  /** The address the census opens: '/waitlist?tab=lists', '/rewards'. */
  path: string;
  kind: ScreenKind;
  /** The permissions that open it; empty means anyone signed in to the app. */
  anyOf: string[];
  /** The file it was read from. */
  source: string;
}

export interface Rpc {
  name: string;
  /** The packages/db module that calls it: 'door', 'waitlist'. */
  module: string;
  source: string;
}

export interface WorkflowStep {
  actor: Role;
  app: AppName;
  /** A Screen.path. */
  screen: string;
  /** What the person does, in words. */
  does: string;
  /** The Rpc names this step calls. */
  rpcs: string[];
}

export interface Workflow {
  key: string;
  title: string;
  steps: WorkflowStep[];
  refusals: { actor: Role; screen: string; expect: string }[];
  /** Checked by the walk, in words. */
  endState: string;
}

export interface Coverage {
  screensVisited: number;
  screensTotal: number;
  rpcsCalled: number;
  rpcsTotal: number;
  pairsChecked: number;
  pairsTotal: number;
  walksFinished: number;
  walksTotal: number;
  gaps: string[];
}
