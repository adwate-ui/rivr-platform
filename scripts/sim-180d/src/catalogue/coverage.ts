import { isLive, type Catalogue } from './catalogue.ts';
import type { Coverage, Screen, Workflow } from './types.ts';

const keyOf = (app: string, path: string): string => `${app} ${path}`;

/** Screens a workflow step opens that the catalogue does not know: a typo, or a screen that is gone. */
export function unknownScreens(screens: readonly Screen[], workflows: readonly Workflow[]): string[] {
  const known = new Set(screens.map((screen) => keyOf(screen.app, screen.path)));
  const paths = new Set(screens.map((screen) => screen.path));
  const unknown = workflows.flatMap((workflow) => [
    ...workflow.steps.filter((each) => !known.has(keyOf(each.app, each.screen))).map((each) => `${workflow.key}: ${keyOf(each.app, each.screen)}`),
    ...workflow.refusals.filter((each) => !paths.has(each.screen)).map((each) => `${workflow.key}: refusal at ${each.screen}`),
  ]);
  return [...new Set(unknown)];
}

/** Live screens no workflow opens. */
export function uncoveredScreens(screens: readonly Screen[], workflows: readonly Workflow[]): string[] {
  const opened = new Set(workflows.flatMap((workflow) => workflow.steps.map((each) => keyOf(each.app, each.screen))));
  return screens.filter(isLive).map((screen) => keyOf(screen.app, screen.path)).filter((key) => !opened.has(key));
}

/** What a run saw: screens the census opened, calls the browsers made, role × screen pairs checked, walks finished. */
export interface Observed {
  visited: ReadonlySet<string>;
  called: ReadonlySet<string>;
  pairsChecked: number;
  pairsTotal: number;
  walksFinished: ReadonlySet<string>;
}

export function computeCoverage(catalogue: Catalogue, workflows: readonly Workflow[], observed: Observed): Coverage {
  const live = catalogue.screens.filter(isLive).map((screen) => keyOf(screen.app, screen.path));
  const notVisited = live.filter((key) => !observed.visited.has(key));
  const notCalled = catalogue.rpcs.filter((rpc) => !observed.called.has(rpc.name)).map((rpc) => `${rpc.module}.${rpc.name}`);
  const notWalked = workflows.filter((workflow) => !observed.walksFinished.has(workflow.key)).map((workflow) => workflow.key);
  return {
    screensVisited: live.length - notVisited.length,
    screensTotal: live.length,
    rpcsCalled: catalogue.rpcs.length - notCalled.length,
    rpcsTotal: catalogue.rpcs.length,
    pairsChecked: observed.pairsChecked,
    pairsTotal: observed.pairsTotal,
    walksFinished: workflows.length - notWalked.length,
    walksTotal: workflows.length,
    gaps: [...notVisited.map((key) => `screen not visited: ${key}`), ...notWalked.map((key) => `walk not finished: ${key}`), ...notCalled.map((name) => `never called: ${name}`)],
  };
}
