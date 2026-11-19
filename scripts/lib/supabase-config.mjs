/** Writes supabase/config.toml for this worktree from the committed template. */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { portBlock, worktreeName, worktreeRoot } from '@rivr/config/worktree';

/** The Send SMS hook's secret: made once per checkout, kept gitignored, readable by its owner only. */
function hookSecret(root) {
  const file = join(root, 'supabase/.hook-secret');
  if (!existsSync(file)) writeFileSync(file, `v1,whsec_${randomBytes(32).toString('base64')}\n`, { mode: 0o600 });
  return readFileSync(file, 'utf8').trim();
}

/** The scheduler's secret for the local functions (decision 0038): made once per checkout, kept as the hook's is. */
function schedulerSecret(root) {
  const file = join(root, 'supabase/.scheduler-secret');
  if (!existsSync(file)) writeFileSync(file, `${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  return readFileSync(file, 'utf8').trim();
}

/** Generates the config and returns the worktree's port block. */
export function writeSupabaseConfig(root = worktreeRoot()) {
  const block = portBlock(root);
  const template = readFileSync(join(root, 'supabase/config.template.toml'), 'utf8');
  const config = template
    .replaceAll('{{PROJECT_ID}}', worktreeName(root))
    .replaceAll('{{BLOCK}}', String(block))
    .replaceAll('{{SEND_SMS_HOOK_SECRET}}', hookSecret(root))
    .replaceAll('{{OUTBOX_SCHEDULER_SECRET}}', schedulerSecret(root));
  writeFileSync(join(root, 'supabase/config.toml'), config);
  return block;
}
