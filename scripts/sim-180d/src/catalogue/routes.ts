import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface RouteFile {
  path: string;
  /** The file, relative to the folder read. */
  file: string;
  /** The file sends its addresses elsewhere (`redirect(`): hidden screens such as the player's Balance. */
  redirects: boolean;
}

/** Every `path: '…'` a TanStack Router app's route files declare, with the file each came from. */
export function readRoutes(dir: string): RouteFile[] {
  const routes = new Map<string, RouteFile>();
  for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' }).sort()) {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
    const text = readFileSync(join(dir, file), 'utf8');
    const redirects = text.includes('redirect(');
    for (const match of text.matchAll(/\bpath:\s*'(\/[^']*)'/g)) {
      const path = match[1] ?? '';
      if (!routes.has(path)) routes.set(path, { path, file, redirects });
    }
  }
  return [...routes.values()].sort((a, b) => a.path.localeCompare(b.path));
}
