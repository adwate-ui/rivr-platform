import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Sheet } from './Sheet.tsx';

function renderSheet() {
  const onClose = vi.fn();
  renderIn(
    <Sheet isOpen onClose={onClose} title="Add time" eyebrow="Table 1">
      <button type="button">Request 1 hour</button>
    </Sheet>,
  );
  return onClose;
}

describe('Sheet', () => {
  it('is a dialog named by its title, with its eyebrow above', () => {
    renderSheet();
    const sheet = screen.getByRole('dialog', { name: 'Add time' });
    expect(sheet).toHaveTextContent('Table 1');
  });

  it('closes with Escape or a tap on the scrim', async () => {
    const onClose = renderSheet();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    const scrim = document.querySelector('[data-scrim]');
    if (!(scrim instanceof HTMLElement)) throw new Error('no scrim');
    await userEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps focus inside', async () => {
    renderSheet();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('shows nothing when closed', () => {
    renderIn(<Sheet isOpen={false} onClose={() => undefined} title="Add time">x</Sheet>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    renderSheet();
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
