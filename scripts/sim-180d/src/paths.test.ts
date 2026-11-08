import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DB_CONTAINER, DB_ROOT, REPO_ROOT, runDir, SIM_HOME } from './paths.ts';

describe('paths', () => {
  it('keeps everything under ~/.rivr-sim180, outside the repository', () => {
    expect(SIM_HOME).toBe(join(homedir(), '.rivr-sim180'));
    expect(DB_ROOT.startsWith(SIM_HOME)).toBe(true);
  });

  it('names the container after the copy, so it never clashes with a worktree stack', () => {
    expect(DB_CONTAINER).toBe('supabase_db_rivr-sim180-db');
  });

  it('finds the repository root', () => {
    expect(existsSync(join(REPO_ROOT, 'pnpm-workspace.yaml'))).toBe(true);
  });

  it('keeps one folder per run', () => {
    expect(runDir('2026-11-15-a')).toBe(join(SIM_HOME, 'runs', '2026-11-15-a'));
  });
});
