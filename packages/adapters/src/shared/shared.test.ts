import { describe, expect, it } from 'vitest';
import { sha256Hex } from './hash.ts';
import { createRecorder } from './recorder.ts';

describe('createRecorder', () => {
  it('records every call, oldest first', () => {
    const recorder = createRecorder<string, { code: 'unavailable' }>();
    recorder.record('first');
    recorder.record('second');

    expect(recorder.calls).toEqual(['first', 'second']);
  });

  it('hands back scripted failures in order, one per call, then none', () => {
    const recorder = createRecorder<string, string>();
    recorder.failNext('down');
    recorder.failNext('busy');

    expect([recorder.record('a'), recorder.record('b'), recorder.record('c')]).toEqual(['down', 'busy', undefined]);
    expect(recorder.calls).toEqual(['a', 'b', 'c']);
  });
});

describe('sha256Hex', () => {
  it('hashes text to lower-case hex with Web Crypto', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
