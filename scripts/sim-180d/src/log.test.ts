import { afterEach, describe, expect, it, vi } from 'vitest';
import { say } from './log.ts';

describe('say', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes one line to stdout', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    say('night 1 of 180');
    expect(write).toHaveBeenCalledWith('night 1 of 180\n');
  });
});
