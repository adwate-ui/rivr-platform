import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { takeUpdateWhenHidden } from './update.ts';

let visibility: DocumentVisibilityState = 'visible';

/** The member leaves the page, or comes back to it. */
function show(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});

afterEach(() => {
  // Back to jsdom's own, from Document.prototype.
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('takeUpdateWhenHidden', () => {
  it('takes a new version at once when the page is out of sight', () => {
    visibility = 'hidden';
    const take = vi.fn();
    takeUpdateWhenHidden(take);
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('waits while the member is on the page, and takes it the next time they leave, once', () => {
    const take = vi.fn();
    takeUpdateWhenHidden(take);
    show('visible');
    expect(take).not.toHaveBeenCalled();

    show('hidden');
    expect(take).toHaveBeenCalledTimes(1);
    show('visible');
    show('hidden');
    expect(take).toHaveBeenCalledTimes(1);
  });
});
