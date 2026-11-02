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

  it('loads Google Tag Manager once, custom scripts blocked before it starts', () => {
    loadTagManager();
    loadTagManager();
    const scripts = document.head.querySelectorAll<HTMLScriptElement>('script[data-tag-manager]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe(`https://www.googletagmanager.com/gtm.js?id=${TAG_MANAGER_CONTAINER}`);
    expect(scripts[0]?.async).toBe(true);
    expect(Reflect.get(window, 'dataLayer')).toEqual([{ 'gtm.blocklist': ['customScripts'] }, expect.objectContaining({ event: 'gtm.js' })]);
  });

  it('never loads it on a draft’s preview page, whose address is its key', () => {
    history.pushState(null, '', '/preview/0b9c2f3e-1111-4222-8333-444455556666');
    loadTagManager();
    expect(document.head.querySelector('script[data-tag-manager]')).toBeNull();
    history.pushState(null, '', '/');
  });
});
