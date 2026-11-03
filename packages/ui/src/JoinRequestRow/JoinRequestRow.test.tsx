import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { JoinRequestRow } from './JoinRequestRow.tsx';

const request = (onApprove = vi.fn(), onDecline = vi.fn()) => ({
  name: 'Ritika Bhalla',
  note: 'asks to join',
  approve: { label: 'Approve', name: 'Approve Ritika Bhalla', onClick: onApprove },
  decline: { label: 'Decline', name: 'Decline Ritika Bhalla', onClick: onDecline },
});

describe('JoinRequestRow', () => {
  it('says who asks and what, then Approve and Decline, each read with the name', async () => {
    const onApprove = vi.fn();
    const onDecline = vi.fn();
    renderIn(<JoinRequestRow {...request(onApprove, onDecline)} />);
    expect(screen.getByText('Ritika Bhalla')).toBeInTheDocument();
    expect(screen.getByText('asks to join')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve Ritika Bhalla' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decline Ritika Bhalla' }));
    expect(onApprove).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it('marks the request as needing the floor with a gold dot on a faint gold band, centred down the row', () => {
    const { container } = renderIn(<JoinRequestRow {...request()} />);
    expect(container.firstElementChild).toHaveClass('bg-gold-tint', 'items-center', 'min-h-touch');
    expect(container.querySelector('.bg-action')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<JoinRequestRow {...request()} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
