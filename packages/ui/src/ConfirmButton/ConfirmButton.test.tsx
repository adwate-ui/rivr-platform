import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ConfirmButton } from './ConfirmButton.tsx';

describe('ConfirmButton', () => {
  it('asks once, then does the step on the second press, in the same place', async () => {
    const onConfirm = vi.fn();
    renderIn(<ConfirmButton label="Leaves" name="Leaves: Ritika Das" confirm="Yes, Ritika leaves" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Leaves: Ritika Das' }));
    expect(onConfirm).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Yes, Ritika leaves' });
    expect(confirm).toHaveFocus();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Leaves: Ritika Das' })).toBeInTheDocument();
  });

  it('on the console, keeps both buttons at a row’s small size, the first a subtle fill (decision 0464)', async () => {
    renderIn(<ConfirmButton variant="subtle" size="small" label="Delete" name="Delete Table 3" confirm="Yes, delete Table 3" onConfirm={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Delete Table 3' })).toHaveClass('bg-subtle', 'text-13');
    await userEvent.click(screen.getByRole('button', { name: 'Delete Table 3' }));
    expect(screen.getByRole('button', { name: 'Yes, delete Table 3' })).toHaveClass('text-13');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('text-13');
  });

  it('works from the keyboard: Enter asks, Enter again does it', async () => {
    const onConfirm = vi.fn();
    renderIn(<ConfirmButton label="Remove" confirm="Yes, remove Ritika" onConfirm={onConfirm} />);
    screen.getByRole('button', { name: 'Remove' }).focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('turns back when left alone for twenty seconds, or on Escape, so a later tap never does the step', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onConfirm = vi.fn();
    renderIn(<ConfirmButton label="Remove" confirm="Yes, remove Ritika" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Confirm or cancel.')).toBeInTheDocument();
    // While the pointer or the focus is on it, its time is held (WCAG 2.2.1).
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByRole('button', { name: 'Yes, remove Ritika' })).toBeInTheDocument();
    await userEvent.unhover(screen.getByRole('button', { name: 'Yes, remove Ritika' }));
    act(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('turns back on Cancel beside the confirmation, and gives the focus back to the button', async () => {
    const onConfirm = vi.fn();
    renderIn(<ConfirmButton label="Leaves" name="Leaves: Ritika Das" confirm="Yes, Ritika leaves" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Leaves: Ritika Das' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Leaves: Ritika Das' })).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('turns back on Escape with the focus on Cancel, giving the focus back to the button', async () => {
    renderIn(<ConfirmButton label="Leaves" name="Leaves: Ritika Das" confirm="Yes, Ritika leaves" onConfirm={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Leaves: Ritika Das' }));
    screen.getByRole('button', { name: 'Cancel' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Leaves: Ritika Das' })).toHaveFocus();
  });

  it('takes no press while the step runs, so it is never sent twice', async () => {
    const onConfirm = vi.fn();
    renderIn(<ConfirmButton label="Remove" confirm="Yes, remove Ritika" isBusy onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: /Remove|Loading/ }));
    expect(screen.queryByRole('button', { name: 'Yes, remove Ritika' })).toBeNull();
  });

  it('does nothing while disabled', async () => {
    const onConfirm = vi.fn();
    renderIn(<ConfirmButton label="Remove" confirm="Yes, remove Ritika" isDisabled onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('button', { name: 'Yes, remove Ritika' })).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('takes the console’s subtle fill and size, and asks at the same size (console v3)', async () => {
    renderIn(<ConfirmButton variant="subtle" size="compact" label="Take off the queue" confirm="Yes, take Ritika off the queue" onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Take off the queue' })).toHaveClass('bg-subtle', 'tablet:min-h-control');
    await userEvent.click(screen.getByRole('button', { name: 'Take off the queue' }));
    expect(screen.getByRole('button', { name: 'Yes, take Ritika off the queue' })).toHaveClass('tablet:min-h-control');
  });

  it('has no accessibility violations, asking or not', async () => {
    const { container } = renderIn(<ConfirmButton label="Leaves" name="Leaves: Ritika Das" confirm="Yes, Ritika leaves" onConfirm={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Leaves: Ritika Das' }));
    expect(await axeViolations(container)).toEqual([]);
  });
});
