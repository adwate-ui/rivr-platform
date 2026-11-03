import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { FRESH_MS, RequestItem } from './RequestItem.tsx';

function renderItem(extra: Partial<Parameters<typeof RequestItem>[0]> = {}) {
  const approve = vi.fn();
  const decline = vi.fn();
  const open = vi.fn();
  const view = renderIn(
    <RequestItem kind="Join request" age="4 min" title="Ritika Bhalla" detail="Table 1 waitlist" onTitle={open}
      primary={{ label: 'Approve', onClick: approve }} secondary={{ label: 'Decline', onClick: decline }} {...extra} />,
  );
  return { ...view, approve, decline, open };
}

describe('RequestItem', () => {
  it('keeps a new request\'s tint for the 2.5 s it takes to fade (decision 0431)', () => {
    expect(FRESH_MS).toBe(2500);
  });

  it('shows the ask of one player in their sheet as a gold-tinted box with its age and actions', async () => {
    const { approve } = renderItem({ look: 'ask', title: 'Wants +1 h', age: '6 min', isLate: true });
    expect(screen.queryByText('Join request')).not.toBeInTheDocument();
    expect(screen.queryByText('Table 1 waitlist')).not.toBeInTheDocument();
    expect(screen.getByText('Wants +1 h').parentElement?.parentElement).toHaveClass('bg-selected');
    expect(screen.getByText('6 min')).toHaveClass('text-danger');
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(approve).toHaveBeenCalledOnce();
  });

  it('says what is asked, how long ago, who asks and where', () => {
    renderItem();
    for (const text of ['Join request', '4 min', 'Table 1 waitlist']) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ritika Bhalla' })).toBeInTheDocument();
  });

  it('fills its one primary action in cream, never gold, and sets the other in words (decision 0429)', () => {
    renderItem();
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveClass('bg-cream');
    expect(screen.getByRole('button', { name: 'Approve' })).not.toHaveClass('bg-action');
    expect(screen.getByRole('button', { name: 'Decline' })).not.toHaveClass('bg-cream');
  });

  it('acts from the keyboard: Tab to the title, Approve and Decline', async () => {
    const { approve, decline, open } = renderItem();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(open).toHaveBeenCalledOnce();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(approve).toHaveBeenCalledOnce();
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(decline).toHaveBeenCalledOnce();
  });

  it('shows an age past its target in the danger colour, and says late, never by colour alone', () => {
    renderItem({ isLate: true });
    const age = screen.getByText('4 min');
    expect(age).toHaveClass('text-danger');
    expect(age).toHaveTextContent('4 min, late');
  });

  it('marks a new request so its tint fades, and an old one not', () => {
    const { container, rerender } = renderItem({ isNew: true });
    expect(container.querySelector('[data-fresh]')).not.toBeNull();
    rerender(<RequestItem kind="Top-up" title="Vidya Chadha" primary={{ label: 'Start', onClick: vi.fn() }} />);
    expect(container.querySelector('[data-fresh]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Vidya Chadha' })).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderItem({ isLate: true });
    expect(await axeViolations(container)).toEqual([]);
  });
});
