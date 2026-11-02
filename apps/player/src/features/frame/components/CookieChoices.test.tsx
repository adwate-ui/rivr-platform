import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CookieChoices } from './CookieChoices.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.head.querySelectorAll('script[data-tag-manager]').forEach((script) => script.remove());
});

const tagManager = () => document.head.querySelector('script[data-tag-manager]');

describe('Sign in › Cookies (decisions 0298, 0320)', () => {
  it('asks in a sheet while the phone holds no choice, and loads nothing on Essential only', async () => {
    render(<CookieChoices />);
    // The sheet loads only when it is needed (the bundle budget).
    expect(await screen.findByRole('dialog', { name: 'Cookies' })).toBeDefined();
    expect(screen.getByText('Essential storage only, unless you allow analytics.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Essential only' }));
    expect(screen.queryByRole('dialog', { name: 'Cookies' })).toBeNull();
    expect(localStorage.getItem('rivr.cookies')).toBe(JSON.stringify({ maps: false, analytics: false }));
    expect(tagManager()).toBeNull();
  });

  it('loads Google Tag Manager once analytics is allowed, and at once when it was allowed before', async () => {
    render(<CookieChoices />);
    fireEvent.click(await screen.findByRole('button', { name: 'Allow analytics' }));
    expect(tagManager()).not.toBeNull();
    cleanup();
    document.head.querySelectorAll('script[data-tag-manager]').forEach((script) => script.remove());
    render(<CookieChoices />);
    expect(screen.queryByRole('dialog', { name: 'Cookies' })).toBeNull();
    expect(tagManager()).not.toBeNull();
  });
});
