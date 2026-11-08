import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runDir, SIM_HOME, srcDir } from './paths.ts';

describe('paths', () => {
  it('keeps everything under ~/.rivr-sim180, outside the repository', () => {
    expect(SIM_HOME).toBe(join(homedir(), '.rivr-sim180'));
  });

  it('keeps one rewritten copy per commit and one folder per run', () => {
    expect(srcDir('f01e4eb1')).toBe(join(SIM_HOME, 'src', 'f01e4eb1'));
    expect(runDir('2026-11-15-a')).toBe(join(SIM_HOME, 'runs', '2026-11-15-a'));
  });
});
