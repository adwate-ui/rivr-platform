import { describe, expect, it } from 'vitest';
import { parseArgs } from './args.ts';

describe('parseArgs', () => {
  it('does nothing by default', () => {
    expect(parseArgs([])).toEqual({ prepare: false, start: null, reset: false, stop: false, to: null });
  });

  it('reads every flag', () => {
    expect(parseArgs(['--prepare', '--start=ui', '--reset', '--to=30'])).toEqual({
      prepare: true,
      start: 'ui',
      reset: true,
      stop: false,
      to: 30,
    });
    expect(parseArgs(['--start=sim']).start).toBe('sim');
  });

  it('skips the -- that pnpm passes through', () => {
    expect(parseArgs(['--', '--reset']).reset).toBe(true);
  });

  it('makes a dry run seven nights', () => {
    expect(parseArgs(['--dry']).to).toBe(7);
  });

  it.each(['--to=181', '--to=-1', '--to=1.5', '--to=x'])('refuses %s', (flag) => {
    expect(() => parseArgs([flag])).toThrow('--to must be 0 to 180');
  });

  it('refuses unknown flags', () => {
    expect(() => parseArgs(['--start=all'])).toThrow('unknown flag --start=all');
  });

  it('runs --stop alone', () => {
    expect(parseArgs(['--stop']).stop).toBe(true);
    expect(() => parseArgs(['--stop', '--reset'])).toThrow('--stop takes no other flag');
  });
});
