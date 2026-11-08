/** The screens of the player app, the tablet (and its door-kiosk mode), the TV display and the website. */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HIDDEN_TV_MODES, TV_MODES } from '@rivr/contracts';
import { REPO_ROOT } from '../paths.ts';
import { readRoutes } from './routes.ts';
import type { Screen } from './types.ts';

const APPS = join(REPO_ROOT, 'apps');
// Open without signing in; every other player screen needs a member.
const PLAYER_PUBLIC = new Set(['/sign-in', '/sign-up']);

export function playerScreens(dir = join(APPS, 'player', 'src', 'routes')): Screen[] {
  return readRoutes(dir).map((route) => ({
    app: 'player',
    path: route.path,
    kind: route.redirects ? 'hidden' : PLAYER_PUBLIC.has(route.path) ? 'route' : 'menu',
    anyOf: [],
    source: `apps/player/src/routes/${route.file}`,
  }));
}

/** One tablet app, two modes: a dealer's table, and the door kiosk (a tablet paired with "Door kiosk" on, Frame.tsx). */
export function tabletScreens(): Screen[] {
  return [
    { app: 'tablet', path: '/', kind: 'menu', anyOf: [], source: 'apps/tablet/src/routes/home.tsx' },
    { app: 'door', path: '/', kind: 'menu', anyOf: [], source: 'apps/tablet/src/features/frame/components/Frame.tsx' },
  ];
}

/** Each thing a TV can be set to show; the census sets it in the console's TV pairing ("What it shows"). */
export function displayScreens(): Screen[] {
  const hidden = new Set<string>(HIDDEN_TV_MODES);
  return TV_MODES.map((mode) => ({
    app: 'display',
    path: `/#${mode}`,
    kind: hidden.has(mode) ? 'hidden' : 'menu',
    anyOf: [],
    source: 'packages/contracts/src/devices.ts',
  }));
}

/** Astro's file routes: index is '/', [slug] is '/$slug' (one per published page), preview/[token] is '/preview/$token'. */
export function webScreens(dir = join(APPS, 'web', 'src', 'pages')): Screen[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.astro'))
    .sort()
    .map((file) => {
      const route = file.replace(/\.astro$/, '').replace(/\[([a-z]+)\]/g, '$$$1');
      return { app: 'web', path: route === 'index' ? '/' : `/${route}`, kind: 'route', anyOf: [], source: `apps/web/src/pages/${file}` };
    });
}
