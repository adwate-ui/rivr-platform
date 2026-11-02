import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { WaitTimer } from './WaitTimer.tsx';

describe('WaitTimer', () => {
  it('shows the wait as a clock, muted while in time', () => {
    renderIn(<WaitTimer seconds={42} isLate={false} />);
    expect(screen.getByText('00:42').className).toContain('text-content-muted');
  });

  it('says Late past the target, on a red marker, not by colour alone', () => {
    renderIn(<WaitTimer seconds={95} isLate />);
    const late = screen.getByText('Late 01:35');
    expect(late.className).toContain('bg-alert');
    expect(late.className).toContain('text-on-alert');
  });

  it('has no accessibility violations in time or late', async () => {
    const { container } = renderIn(<><WaitTimer seconds={42} isLate={false} /><WaitTimer seconds={95} isLate /></>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
