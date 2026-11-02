import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CookieChoices } from './CookieChoices.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.head.querySelectorAll('script[data-tag-manager]').forEach((script) => script.remove());
});

const tagManager = () => document.head.querySelector('script[data-tag-manager]');

describe('the app\'s cookie choices (decision 0298)', () => {
  it('asks while the phone holds no choice, and loads nothing on Essential only', () => {
    render(<CookieChoices />);
    fireEvent.click(screen.getByRole('button', { name: 'Essential only' }));
    expect(screen.queryByRole('region', { name: 'Cookies in this app' })).toBeNull();
    expect(localStorage.getItem('rivr.cookies')).toBe(JSON.stringify({ maps: false, analytics: false }));
    expect(tagManager()).toBeNull();
  });

  it('loads Google Tag Manager once analytics is allowed, and at once when it was allowed before', () => {
    render(<CookieChoices />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    expect(tagManager()).not.toBeNull();
    cleanup();
    document.head.querySelectorAll('script[data-tag-manager]').forEach((script) => script.remove());
    render(<CookieChoices />);
    expect(screen.queryByRole('region', { name: 'Cookies in this app' })).toBeNull();
    expect(tagManager()).not.toBeNull();
  });
});
