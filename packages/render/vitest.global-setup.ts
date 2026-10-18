import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

/** True when @rivr/ui's compiled stylesheet exists; the host imports it as the apps do. */
function uiStylesheetIsBuilt(): boolean {
  try {
    createRequire(import.meta.url).resolve('@rivr/ui/styles.css');
    return true;
  } catch {
    return false;
  }
}

/** Builds what the render tests draw with: @rivr/ui's stylesheet when missing, then the host page. */
export default async function buildRenderHost(): Promise<void> {
  if (!uiStylesheetIsBuilt()) execFileSync('pnpm', ['--filter', '@rivr/ui', 'build'], { stdio: 'inherit' });
  await build({ configFile: fileURLToPath(new URL('./vite.config.ts', import.meta.url)) });
}
