import { execFileSync } from 'node:child_process';
import { localBinary, worktreeRoot } from '@rivr/config/worktree';

/** The local stack's service-role key, for a flow that does what a server job would. It never leaves this machine. */
export function serviceRoleKey(): string {
  const root = worktreeRoot();
  const status: unknown = JSON.parse(execFileSync(localBinary('supabase', root), ['status', '-o', 'json'], { cwd: root, encoding: 'utf8' }));
  const key: unknown = typeof status === 'object' && status !== null ? Reflect.get(status, 'SERVICE_ROLE_KEY') : undefined;
  if (typeof key !== 'string') throw new Error('The local stack is not running');
  return key;
}
