import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { BulkBar, type BulkBarAction } from './BulkBar.tsx';

function actionsWith(onHold = vi.fn(), onRemove = vi.fn()): BulkBarAction[] {
  return [
    { id: 'hold', label: 'Hold', onClick: onHold },
    { id: 'remove', label: 'Remove', onClick: onRemove, isMain: true },
  ];
}

const bar = () => screen.getByRole('region', { name: 'Selected rows' });

describe('BulkBar', () => {
  it('is a named region at the top of the list, saying how many are chosen, politely', () => {
    renderIn(<BulkBar count={3} actions={actionsWith()} onClear={() => undefined} />);
    expect(bar()).toHaveClass('sticky', 'top-0', 'z-nav', 'bg-cream', 'text-on-cream', 'rounded-lg');
    expect(screen.getByText('3 selected')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('3 selected')).toHaveClass('text-14', 'font-semibold');
  });

  it('runs an action, and clears the choice', async () => {
    const onHold = vi.fn();
    const onClear = vi.fn();
    renderIn(<BulkBar count={2} actions={actionsWith(onHold)} onClear={onClear} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hold' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onHold).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('fills the main action in ink and sets the rest as words, a danger one in red', () => {
    const actions: BulkBarAction[] = [...actionsWith(), { id: 'ban', label: 'Ban', onClick: vi.fn(), tone: 'danger' }];
    renderIn(<BulkBar count={2} actions={actions} onClear={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveClass('bg-ink', 'text-cream');
    expect(screen.getByRole('button', { name: 'Hold' })).toHaveClass('text-on-cream');
    expect(screen.getByRole('button', { name: 'Hold' })).not.toHaveClass('bg-ink');
    expect(screen.getByRole('button', { name: 'Ban' })).toHaveClass('text-alert');
  });

  it('keeps a 44 px target below 1180 px, 32 px at a desk', () => {
    renderIn(<BulkBar count={1} actions={actionsWith()} onClear={() => undefined} />);
    for (const name of ['Hold', 'Remove', 'Clear']) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-touch', 'tablet:min-h-8', 'items-center', 'leading-control');
    }
  });

  it('shows a busy action as such and ignores its presses', async () => {
    const onRemove = vi.fn();
    const actions: BulkBarAction[] = [{ id: 'remove', label: 'Remove', onClick: onRemove, isMain: true, isLoading: true }];
    renderIn(<BulkBar count={2} actions={actions} onClear={() => undefined} />);
    const remove = screen.getByRole('button', { name: 'Remove' });
    expect(remove).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(remove);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('shows nothing while none is chosen, keeping its count for screen readers so the first tick is announced', () => {
    const { rerender } = renderIn(<BulkBar count={0} actions={actionsWith()} onClear={() => undefined} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toBeEmptyDOMElement();
    rerender(<BulkBar count={1} actions={actionsWith()} onClear={() => undefined} />);
    expect(document.querySelector('[aria-live="polite"]')).toBe(live);
    expect(live).toHaveTextContent('1 selected');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<BulkBar count={4} actions={actionsWith()} onClear={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
