import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { UrgentChime } from './UrgentChime.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A stand-in for the browser's Web Audio that counts the chimes played. */
function stubAudio() {
  const played = { count: 0 };
  const node = () => ({ connect: (next: unknown) => next, frequency: { value: 0 }, gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, start: vi.fn(), stop: vi.fn() });
  vi.stubGlobal('AudioContext', class {
    currentTime = 0;
    destination = {};
    constructor() { played.count += 1; }
    createOscillator = node;
    createGain = node;
    resume = async () => undefined;
    close = async () => undefined;
  });
  return played;
}

describe('UrgentChime', () => {
  it('chimes and tells a screen reader when an urgent queue grows, never on the first read nor as one shrinks', () => {
    const played = stubAudio();
    const { rerender } = renderIn(<UrgentChime counts={null} />);
    rerender(<UrgentChime counts={{ topUps: 1, waitlist: 0 }} />);
    expect(played.count).toBe(0);
    expect(screen.getByRole('status').textContent).toBe('');
    rerender(<UrgentChime counts={{ topUps: 2, waitlist: 0 }} />);
    expect(played.count).toBe(1);
    expect(screen.getByRole('status').textContent).toBe('2 urgent waiting');
    rerender(<UrgentChime counts={{ topUps: 1, waitlist: 0 }} />);
    expect(played.count).toBe(1);
  });

  it('chimes when one queue grows as another clears, though the sum stays the same', () => {
    const played = stubAudio();
    const { rerender } = renderIn(<UrgentChime counts={{ topUps: 1, waitlist: 0 }} />);
    rerender(<UrgentChime counts={{ topUps: 0, waitlist: 1 }} />);
    expect(played.count).toBe(1);
  });

  it('stays silent in a browser without Web Audio, and still tells a screen reader', () => {
    vi.stubGlobal('AudioContext', undefined);
    const { rerender } = renderIn(<UrgentChime counts={{ fnb: 0 }} />);
    rerender(<UrgentChime counts={{ fnb: 1 }} />);
    expect(screen.getByRole('status').textContent).toBe('1 urgent waiting');
  });
});
