/** Writes supabase/config.toml for this worktree from the committed template. */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { portBlock, worktreeName, worktreeRoot } from '@rivr/config/worktree';

/**
 * The secret Auth signs its Send SMS hook calls with, shared with the function. Made once per
 * checkout and kept in a gitignored file, so it stays the same while containers run and never
 * reaches the repository.
 */
function hookSecret(root) {
  const file = join(root, 'supabase/.hook-secret');
  // Readable by its owner only.
  if (!existsSync(file)) writeFileSync(file, `v1,whsec_${randomBytes(32).toString('base64')}\n`, { mode: 0o600 });
  return readFileSync(file, 'utf8').trim();
}

/** Generates the config and returns the worktree's port block. */
export function writeSupabaseConfig(root = worktreeRoot()) {
  const block = portBlock(root);
  const template = readFileSync(join(root, 'supabase/config.template.toml'), 'utf8');
  const config = template
    .replaceAll('{{PROJECT_ID}}', worktreeName(root))
    .replaceAll('{{BLOCK}}', String(block))
    .replaceAll('{{SEND_SMS_HOOK_SECRET}}', hookSecret(root));
  writeFileSync(join(root, 'supabase/config.toml'), config);
  return block;
}
