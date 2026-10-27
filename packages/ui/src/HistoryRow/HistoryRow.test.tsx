import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Money } from '../Money/Money.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { HistoryRow } from './HistoryRow.tsx';

describe('HistoryRow', () => {
  it('shows when, what, its figure and the detail as one button', async () => {
    const { container } = renderIn(
      <HistoryRow when="13 Feb 2026" title="Table 2" value={<Money paise={2_650_000n} signed tone="player" />} detail="100/200 · 6 h 30 min" onOpen={() => {}} />,
    );
    const row = screen.getByRole('button', { name: /Table 2/ });
    expect(row).toHaveTextContent('13 Feb 2026');
    expect(row).toHaveTextContent('+₹26,500');
    expect(row).toHaveTextContent('100/200 · 6 h 30 min');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('opens by a tap, Enter or Space', async () => {
    const onOpen = vi.fn();
    renderIn(<HistoryRow when="13 Feb 2026" title="Table 2" value={null} detail="100/200 · 6 h 30 min" onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: /Table 2/ }));
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onOpen).toHaveBeenCalledTimes(3);
  });
});
