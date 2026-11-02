import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnalyticsSwitch } from './AnalyticsSwitch.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.head.querySelectorAll('script[data-tag-manager]').forEach((script) => script.remove());
});

describe('analytics in Profile (decision 0298)', () => {
  it('changes the cookie banner’s choice later, and loads Google Tag Manager once it is on', () => {
    localStorage.setItem('rivr.cookies', JSON.stringify({ maps: false, analytics: false }));
    render(<AnalyticsSwitch />);
    fireEvent.click(screen.getByRole('switch', { name: /^Analytics/ }));
    expect(localStorage.getItem('rivr.cookies')).toBe(JSON.stringify({ maps: false, analytics: true }));
    expect(document.head.querySelector('script[data-tag-manager]')).not.toBeNull();
  });
});
