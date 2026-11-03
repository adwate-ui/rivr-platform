import { describe, expect, it } from 'vitest';
import { onNotificationOpened } from './notificationLinks.ts';

const PLACE = '00000000-0000-4000-8000-0000000005e1';

/** The plugin's `opened` events, which the test sends, and whether the listener was removed. */
function links() {
  let listener: (opened: { path: string }) => void = () => undefined;
  let removed = false;
  return {
    plugin: {
      addListener: async (_event: 'opened', given: (opened: { path: string }) => void) => {
        listener = given;
        return { remove: async () => { removed = true; } };
      },
    },
    tap: (path: string) => listener({ path }),
    isRemoved: () => removed,
  };
}

describe('onNotificationOpened', () => {
  it('listens to nothing in a browser', () => {
    expect(() => onNotificationOpened(() => undefined)()).not.toThrow();
  });

  it('opens only the pages a lock-screen status names: Tonight, a seat call’s answer, and Order', async () => {
    const { plugin, tap, isRemoved } = links();
    const opened: string[] = [];
    const stop = onNotificationOpened((path) => opened.push(path), plugin);
    await Promise.resolve();

    for (const path of ['/', `/?accept=${PLACE}`, '/fnb', '/profile', '//evil.example/', 'https://evil.example/', '/?accept=x']) tap(path);
    stop();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(opened).toEqual(['/', `/?accept=${PLACE}`, '/fnb']);
    expect(isRemoved()).toBe(true);
  });
});
