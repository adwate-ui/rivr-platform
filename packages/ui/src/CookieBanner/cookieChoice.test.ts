import { afterEach, describe, expect, it } from 'vitest';
import { keepCookieChoice, loadTagManager, storedCookieChoice, TAG_MANAGER_CONTAINER } from './cookieChoice.ts';

afterEach(() => {
  localStorage.clear();
  document.head.querySelectorAll('script[data-tag-manager]').forEach((script) => script.remove());
  Reflect.deleteProperty(window, 'dataLayer');
});

describe('the cookie choice', () => {
  it('is kept in this browser and read back; none kept, or one from before analytics was asked, asks again', () => {
    expect(storedCookieChoice()).toBeNull();
    keepCookieChoice({ maps: true, analytics: false });
    expect(storedCookieChoice()).toEqual({ maps: true, analytics: false });
    localStorage.setItem('rivr.cookies', JSON.stringify({ maps: true }));
    expect(storedCookieChoice()).toBeNull();
    localStorage.setItem('rivr.cookies', '{not json');
    expect(storedCookieChoice()).toBeNull();
  });

  it('loads Google Tag Manager once, with its start on the data layer', () => {
    loadTagManager();
    loadTagManager();
    const scripts = document.head.querySelectorAll<HTMLScriptElement>('script[data-tag-manager]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe(`https://www.googletagmanager.com/gtm.js?id=${TAG_MANAGER_CONTAINER}`);
    expect(scripts[0]?.async).toBe(true);
    expect(Reflect.get(window, 'dataLayer')).toEqual([expect.objectContaining({ event: 'gtm.js' })]);
  });
});
