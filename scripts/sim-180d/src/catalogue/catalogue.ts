import { displayScreens, playerScreens, tabletScreens, webScreens } from './apps.ts';
import { consoleScreens, loadConsoleMenu, readConsoleRoutes } from './console.ts';
import { readRpcs } from './rpcs.ts';
import type { Rpc, Screen } from './types.ts';

export interface Catalogue {
  screens: Screen[];
  rpcs: Rpc[];
}

/** Every screen of every app, and every call the data layer makes, read from the code at HEAD. */
export async function readCatalogue(): Promise<Catalogue> {
  const console = consoleScreens(await loadConsoleMenu(), readConsoleRoutes());
  return {
    screens: [...playerScreens(), ...console, ...tabletScreens(), ...displayScreens(), ...webScreens()],
    rpcs: readRpcs(),
  };
}

/** A screen the club uses today: not hidden by the owner's 29 Oct decision, and not an old address that redirects. */
export function isLive(screen: Screen): boolean {
  return screen.kind === 'menu' || screen.kind === 'tab' || (screen.kind === 'route' && (screen.app === 'web' || screen.app === 'player'));
}
