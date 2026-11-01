import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { KillSwitchBanner } from './KillSwitchBanner.tsx';

describe('KillSwitchBanner', () => {
  it('tells a member the club is paused', () => {
    renderIn(<KillSwitchBanner audience="member" />);
    expect(screen.getByRole('alert')).toHaveTextContent('The club is paused. Ask a member of staff.');
  });

  it('tells staff their writes are refused', () => {
    renderIn(<KillSwitchBanner audience="staff" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Venue frozen. Changes are refused until it is released.');
  });

  it('cannot be dismissed', () => {
    renderIn(<KillSwitchBanner audience="member" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<KillSwitchBanner audience="staff" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
