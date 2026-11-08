/**
 * The console's screens, read from the console itself: its menu (railEntries.ts: RAIL, REQUESTS, HIDDEN), the
 * addresses its router answers (routes/*.tsx), and which role may open what (ROLE_PERMISSIONS in @rivr/contracts).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROLE_PERMISSIONS, STAFF_ROLES, type StaffRole } from '@rivr/contracts';
import { z } from 'zod';
import { REPO_ROOT } from '../paths.ts';
import type { Role, Screen } from './types.ts';

const CONSOLE = join(REPO_ROOT, 'apps', 'console', 'src');
const MENU_FILE = join(CONSOLE, 'features', 'frame', 'components', 'railEntries.ts');
const ROUTES_DIR = join(CONSOLE, 'routes');
const MENU_SOURCE = 'apps/console/src/features/frame/components/railEntries.ts';

const tabSchema = z.object({ id: z.string(), anyOf: z.array(z.string()) });
const entrySchema = z.object({ id: z.string(), href: z.string(), anyOf: z.array(z.string()), tabs: z.array(tabSchema).optional() });
const menuSchema = z.object({
  RAIL: z.array(z.object({ entries: z.array(entrySchema) })),
  REQUESTS: entrySchema,
  HIDDEN: z.array(z.object({ href: z.string() })),
});

type MenuEntry = z.infer<typeof entrySchema>;

export interface ConsoleMenu {
  entries: MenuEntry[];
  hidden: string[];
}

/** Imported at run time and checked here, not type-checked: its types come from @rivr/ui, which needs the console's JSX settings. */
export async function loadConsoleMenu(file = MENU_FILE): Promise<ConsoleMenu> {
  const parsed = menuSchema.parse(await import(pathToFileURL(file).href));
  return { entries: [...parsed.RAIL.flatMap((group) => group.entries), parsed.REQUESTS], hidden: parsed.HIDDEN.map((screen) => screen.href) };
}

/** Every `path: '…'` the console's route files declare. */
export function readConsoleRoutes(dir = ROUTES_DIR): string[] {
  const paths = new Set<string>();
  for (const name of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
    for (const match of readFileSync(join(dir, name), 'utf8').matchAll(/\bpath:\s*'([^']+)'/g)) paths.add(`${match[1] ?? ''}`);
  }
  return [...paths].filter((path) => path.startsWith('/')).sort();
}

function menuScreens(entry: MenuEntry): Screen[] {
  if (!entry.tabs || entry.tabs.length === 0) {
    return [{ app: 'console', path: entry.href, kind: 'menu', anyOf: entry.anyOf, source: MENU_SOURCE }];
  }
  return entry.tabs.map((tab) => ({ app: 'console', path: `${entry.href}?tab=${tab.id}`, kind: 'tab', anyOf: tab.anyOf, source: MENU_SOURCE }));
}

export function consoleScreens(menu: ConsoleMenu, routes: readonly string[]): Screen[] {
  const screens = menu.entries.flatMap(menuScreens);
  const taken = new Set([...screens.map((screen) => screen.path), ...menu.entries.map((entry) => entry.href)]);
  for (const href of menu.hidden) {
    screens.push({ app: 'console', path: href, kind: 'hidden', anyOf: [], source: MENU_SOURCE });
    taken.add(href);
  }
  for (const path of routes) {
    if (!taken.has(path)) screens.push({ app: 'console', path, kind: 'route', anyOf: [], source: 'apps/console/src/routes' });
  }
  return screens;
}

const STAFF: ReadonlySet<string> = new Set(STAFF_ROLES);

function isStaffRole(role: Role): role is StaffRole {
  return STAFF.has(role);
}

/** The menu screens a role sees: an empty anyOf is anyone signed in to the console. */
export function screensFor(screens: readonly Screen[], role: Role): Screen[] {
  if (!isStaffRole(role)) return [];
  const held = new Set<string>(ROLE_PERMISSIONS[role]);
  return screens.filter((screen) => (screen.kind === 'menu' || screen.kind === 'tab') && (screen.anyOf.length === 0 || screen.anyOf.some((permission) => held.has(permission))));
}
