/**
 * Checkpoint snapshots: the database and storage volumes of the copy's stack, copied while the stack is stopped.
 * A pg_dump would not restore cleanly into a running Supabase database (objects only supabase_admin owns, and the
 * services' open connections), and this copy is exact. The helper container is the stack's own Postgres image, which
 * has tar, so nothing new is pulled.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ServiceSet } from '../../src/cli/args.ts';
import { DB_CONTAINER, PROJECT_ID } from '../../src/paths.ts';
import { start, stop } from './supabase.ts';

const VOLUMES = [`supabase_db_${PROJECT_ID}`, `supabase_storage_${PROJECT_ID}`];

function postgresImage(): string {
  return execFileSync('docker', ['inspect', DB_CONTAINER, '--format', '{{.Config.Image}}'], { encoding: 'utf8' }).trim();
}

/** Runs a shell line in a throwaway container with the volume at /v and the snapshot folder at /s. */
function inVolume(image: string, volume: string, dir: string, line: string): void {
  execFileSync('docker', ['run', '--rm', '-v', `${volume}:/v`, '-v', `${dir}:/s`, '--entrypoint', 'sh', image, '-c', line], { stdio: 'inherit' });
}

/** Saves the stack's volumes as `<dir>/<name>.<volume>.tgz`, then starts the stack again with the same services. */
export function snapshot(repoRoot: string, set: ServiceSet, dir: string, name: string): void {
  mkdirSync(dir, { recursive: true });
  const image = postgresImage();
  stop(repoRoot);
  for (const volume of VOLUMES) inVolume(image, volume, dir, `tar -czf "/s/${name}.${volume}.tgz" -C /v .`);
  start(repoRoot, set);
}

/** Puts a snapshot's volumes back, replacing what is there, then starts the stack. */
export function restore(repoRoot: string, set: ServiceSet, dir: string, name: string): void {
  const image = postgresImage();
  stop(repoRoot);
  for (const volume of VOLUMES) {
    inVolume(image, volume, dir, `find /v -mindepth 1 -delete && tar -xzf "/s/${name}.${volume}.tgz" -C /v`);
  }
  start(repoRoot, set);
}

export function snapshotFile(dir: string, name: string): string {
  return join(dir, `${name}.${VOLUMES[0] ?? ''}.tgz`);
}
