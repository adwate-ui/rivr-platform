import type { AuthStatus } from '@rivr/db';
import { Text } from '@rivr/ui';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Frame } from './Frame.tsx';
import { OverlayFrame } from './OverlayFrame.tsx';

const auth: { status: AuthStatus } = vi.hoisted(() => ({ status: 'loading' }));
vi.mock('@rivr/db', () => ({ useAuthStatus: () => auth.status, useControlState: () => ({ isVenueFrozen: false }) }));

afterEach(cleanup);

/** The frame round a clock, signed in or out as `status`. */
function framed(status: AuthStatus, isOverlay: boolean) {
  auth.status = status;
  const Shown = isOverlay ? OverlayFrame : Frame;
  return <Shown unpaired={<Text>Code</Text>}><Text>Clock</Text></Shown>;
}

describe('the TV’s frame', () => {
  it('shows a TV its code again once it is unpaired', () => {
    const { rerender } = render(framed('signed-in', false));
    expect(screen.getByText('Clock')).toBeDefined();
    rerender(framed('signed-out', false));
    expect(screen.getByText('Code')).toBeDefined();
  });

  it('shows the stream overlay its code until it is paired, and never on the stream after (decision 0256)', () => {
    const { rerender } = render(framed('signed-out', true));
    expect(screen.getByText('Code')).toBeDefined();
    rerender(framed('signed-in', true));
    expect(screen.getByText('Clock')).toBeDefined();
    rerender(framed('signed-out', true));
    expect(screen.queryByText('Code')).toBeNull();
    expect(screen.getByText('Clock')).toBeDefined();
  });
});
