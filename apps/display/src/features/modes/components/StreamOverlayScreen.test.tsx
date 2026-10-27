import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { overlayDelay, StreamOverlayScreen } from './StreamOverlayScreen.tsx';

afterEach(cleanup);

describe('the stream overlay’s address (decision 0256)', () => {
  it('takes a delay of whole seconds up to an hour', () => {
    expect([0, 900, 3600].map(overlayDelay)).toEqual([0, 900, 3600]);
  });

  it('takes nothing else: none, minutes, a fraction, a negative, more than an hour', () => {
    expect([undefined, '15m', '900', 1.5, -1, 3601].map(overlayDelay)).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
  });

  it('without a delay, says how to add one, where OBS shows it before the stream starts', () => {
    render(<StreamOverlayScreen delaySeconds={undefined} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Stream overlay' })).toBeDefined();
    expect(screen.getByText(/This address has no hole-card delay/)).toBeDefined();
  });
});
