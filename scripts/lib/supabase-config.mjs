/** Writes supabase/config.toml for this worktree from the committed template. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { portBlock, worktreeName, worktreeRoot } from './worktree.mjs';

/** Generates the config and returns the worktree's port block. */
export function writeSupabaseConfig(root = worktreeRoot()) {
  const block = portBlock(root);
  const template = readFileSync(join(root, 'supabase/config.template.toml'), 'utf8');
  const config = template
    .replaceAll('{{PROJECT_ID}}', worktreeName(root))
    .replaceAll('{{BLOCK}}', String(block));
  writeFileSync(join(root, 'supabase/config.toml'), config);
  return block;
}
