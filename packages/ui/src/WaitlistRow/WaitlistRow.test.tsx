import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { WaitlistRow } from './WaitlistRow.tsx';

const place = {
  position: 1,
  name: 'Kabir Sethi',
  meta: '35 min',
};

describe('WaitlistRow', () => {
  it('offers a second action before the first, read with who it acts on', () => {
    const onCall = vi.fn();
    renderIn(<WaitlistRow position={1} name="Ishaan Verma" action={{ label: 'Seat', name: 'Seat Ishaan Verma', onClick: vi.fn() }}
      secondary={{ label: 'Call', name: 'Call Ishaan Verma', onClick: onCall }} />);
    screen.getByRole('button', { name: 'Call Ishaan Verma' }).click();
    expect(onCall).toHaveBeenCalledOnce();
  });

  it('shows the place, who and how long, with Seat read with the name', async () => {
    const onSeat = vi.fn();
    renderIn(<WaitlistRow {...place} action={{ label: 'Seat', name: 'Seat Kabir Sethi', onClick: onSeat }} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('35 min')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Seat Kabir Sethi' }));
    expect(onSeat).toHaveBeenCalledOnce();
  });

  it('ticks the row for a bulk action, read with the name', async () => {
    const onToggle = vi.fn();
    renderIn(<WaitlistRow {...place} tick={{ label: 'Select Kabir Sethi', isTicked: false, onToggle }} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Kabir Sethi' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('opens its menu from the ⋯ button and runs the step chosen', async () => {
    const onHold = vi.fn();
    renderIn(<WaitlistRow {...place} menu={{ label: 'More for Kabir Sethi', items: [{ id: 'hold', label: 'Hold place', onSelect: onHold }] }} />);
    await userEvent.click(screen.getByRole('button', { name: 'More for Kabir Sethi' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hold place' }));
    expect(onHold).toHaveBeenCalledOnce();
  });

  it('mutes the name of a place held while the member is away', () => {
    renderIn(<WaitlistRow {...place} isHeld />);
    expect(screen.getByText('Kabir Sethi')).toHaveClass('text-content-muted');
  });

  it('is 44 px below 1180 px and 42 or 34 px at a desk, by density, everything centred down it', () => {
    const { container, rerender } = renderIn(<WaitlistRow {...place} />);
    expect(container.firstElementChild).toHaveClass('min-h-touch', 'tablet:min-h-row', 'items-center');
    rerender(<WaitlistRow {...place} density="compact" />);
    expect(container.firstElementChild).toHaveClass('tablet:min-h-row-compact');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(
      <WaitlistRow {...place} tick={{ label: 'Select Kabir Sethi', isTicked: true, onToggle: vi.fn() }}
        action={{ label: 'Seat', name: 'Seat Kabir Sethi', onClick: vi.fn() }}
        menu={{ label: 'More for Kabir Sethi', items: [{ id: 'hold', label: 'Hold place', onSelect: vi.fn() }] }} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('marks a place waiting past the target in the danger red, its line saying so in words (audit F-075)', () => {
    renderIn(<WaitlistRow position={1} name="Mira Shah" meta="Late · 50 min" isLate />);
    expect(screen.getByText('Late · 50 min')).toHaveClass('text-danger');
  });
});
