import { describe, expect, it } from 'vitest';
import { erasureBlockerOf, erasureFailureOf, filesRemovedOf } from './memberErasure.ts';

describe('erasureFailureOf', () => {
  it('says why an erasure was refused', () => {
    expect(erasureFailureOf({ code: '42501' })).toBe('not_allowed');
    expect(erasureFailureOf({ code: 'RVNAM' })).toBe('wrong_name');
    expect(erasureFailureOf({ code: '22023' })).toBe('invalid_reason');
    expect(erasureFailureOf({ code: 'RVERA' })).toBe('open_items');
    expect(erasureFailureOf({ code: 'RVERD' })).toBe('erased');
    expect(erasureFailureOf({ code: 'RVRAT' })).toBe('too_soon');
    expect(erasureFailureOf({ code: 'RVFRZ' })).toBe('paused');
    expect(erasureFailureOf({ code: 'RVMBR' })).toBe('paused');
  });

  it('calls anything else unavailable', () => {
    expect(erasureFailureOf({ code: 'XX000' })).toBe('unavailable');
  });
});

describe('erasureBlockerOf', () => {
  it('knows what the database lists', () => {
    expect(erasureBlockerOf('cash')).toBe('cash');
    expect(erasureBlockerOf('academy')).toBe('academy');
  });

  it('never shows a blocker it does not know as another', () => {
    expect(() => erasureBlockerOf('something_new')).toThrow('Unknown erasure blocker');
  });
});

describe('filesRemovedOf', () => {
  it('reads how many KYC files the Edge Function removed', () => {
    expect(filesRemovedOf({ filesRemoved: 2 })).toBe(2);
    expect(filesRemovedOf({ filesRemoved: 0 })).toBe(0);
  });

  it('reads anything else as files still to remove', () => {
    expect(filesRemovedOf({ filesRemoved: -1 })).toBeNull();
    expect(filesRemovedOf({ filesRemoved: '2' })).toBeNull();
    expect(filesRemovedOf(null)).toBeNull();
  });
});
