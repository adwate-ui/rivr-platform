/** The worktree's app ports, freed before a census or a walk: a run that was stopped can leave a preview server behind. */
import { execFileSync } from 'node:child_process';
import { appPort } from '@rivr/config/worktree';
import { APPS } from '../../../../e2e/support/apps.ts';

export function freeAppPorts(): void {
  for (const app of APPS) {
    // Only what listens on this worktree's own ports (block 557); other worktrees' servers are untouched.
    execFileSync('sh', ['-c', 'fuser -k -n tcp "$1" >/dev/null 2>&1 || true', 'sh', String(appPort(app))]);
  }
}
