import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ChoiceSheet } from './ChoiceSheet.tsx';

const CHOICES = [
  { value: '1', label: '24 hours', detail: 'Until Wed 17 Feb, 00:10' },
  { value: '7', label: '7 days', detail: 'Until Tue 23 Feb, 00:10' },
];

function renderSheet(props: { isBusy?: boolean } = {}) {
  const onChoose = vi.fn();
  const onCancel = vi.fn();
  renderIn(
    <ChoiceSheet isOpen title="Take a break" description="Waitlists and buy-ins close." choices={CHOICES} onChoose={onChoose} onCancel={onCancel} {...props} />,
  );
  return { onChoose, onCancel };
}

describe('ChoiceSheet', () => {
  it('is a dialog named by its title and described by what choosing does', () => {
    renderSheet();
    const sheet = screen.getByRole('dialog', { name: 'Take a break' });
    expect(sheet).toHaveAccessibleDescription('Waitlists and buy-ins close.');
    expect(screen.getByRole('button', { name: '24 hours Until Wed 17 Feb, 00:10' })).toBeInTheDocument();
  });

  it('gives the value of the choice pressed', async () => {
    const { onChoose } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: /^7 days/ }));
    expect(onChoose).toHaveBeenCalledWith('7');
  });

  it('cancels with Cancel or Escape', async () => {
    const { onCancel } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('keeps focus inside the sheet and ignores choices while busy', async () => {
    const { onChoose } = renderSheet({ isBusy: true });
    await userEvent.tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /^24 hours/ }));
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    renderSheet();
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
