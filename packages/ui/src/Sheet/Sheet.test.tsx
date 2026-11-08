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

  it('closes with its Close, a 44 px button at the title’s end that a screen reader reaches, and shows no grabber (8 Nov audit, F-060)', async () => {
    const onClose = renderSheet();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveClass('size-touch');
    // On the title's own line: the title and any aside, then Close.
    expect(screen.getByRole('heading', { name: 'Add time' }).parentElement?.parentElement).toContainElement(close);
    expect(document.querySelector('[data-sheet] .w-grabber')).toBeNull();
    await userEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
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

  describe('in the console form (console v3)', () => {
    function renderConsole() {
      const onClose = vi.fn();
      renderIn(
        <Sheet place="console" isOpen onClose={onClose} title="Vidya Chadha" subtitle="Table 1, seat 2"
          footer={<button type="button">Add 1 h</button>}>
          <button type="button">30 min</button>
        </Sheet>,
      );
      return onClose;
    }

    it('is a dialog named by its title, with its line under it and its actions at the foot', () => {
      renderConsole();
      const sheet = screen.getByRole('dialog', { name: 'Vidya Chadha' });
      expect(sheet).toHaveTextContent('Table 1, seat 2');
      expect(screen.getByRole('button', { name: 'Add 1 h' })).toBeInTheDocument();
    });

    it('sits down the right from 768 px at 440 px, and from the foot below', () => {
      renderConsole();
      expect(screen.getByRole('dialog')).toHaveClass('top-16', 'bottom-0', 'medium:right-0', 'medium:w-side-panel');
    });

    it('closes with Escape, its Close button and the scrim', async () => {
      const onClose = renderConsole();
      await userEvent.keyboard('{Escape}');
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      const scrim = document.querySelector('[data-scrim]');
      if (!(scrim instanceof HTMLElement)) throw new Error('no scrim');
      await userEvent.click(scrim);
      expect(onClose).toHaveBeenCalledTimes(3);
    });

    it('scrolls its content between a title and actions that stay', () => {
      renderConsole();
      const content = screen.getByRole('button', { name: '30 min' }).parentElement;
      expect(content).toHaveClass('overflow-y-auto', 'flex-1');
      expect(content).not.toContainElement(screen.getByRole('button', { name: 'Add 1 h' }));
    });

    it('has no accessibility violations', async () => {
      renderConsole();
      expect(await axeViolations(document.body)).toEqual([]);
    });
  });
});
