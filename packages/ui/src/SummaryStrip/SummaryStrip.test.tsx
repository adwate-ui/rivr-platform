import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { SummaryStrip } from './SummaryStrip.tsx';

const LAST = 'Last: Siddharth Vaid, Four Nines, 01:12';

describe('SummaryStrip', () => {
  it('names itself by its label and shows its lead, its facts and its detail', () => {
    renderIn(<SummaryStrip label="High hand bonus" lead="2 hands paid tonight" facts={['15,000 Bonus']} detail={LAST} />);
    const strip = within(screen.getByRole('region', { name: 'High hand bonus' }));
    expect(strip.getByText('2 hands paid tonight')).toBeInTheDocument();
    expect(strip.getByText('15,000 Bonus')).toBeInTheDocument();
    expect(strip.getByText(LAST)).toBeInTheDocument();
  });

  it('keeps to one line: the detail is the part cut short, with its full words in its title', () => {
    renderIn(<SummaryStrip label="High hand bonus" lead="12 hands paid tonight" facts={['1,25,000 Bonus']} detail={LAST} />);
    expect(screen.getByRole('region', { name: 'High hand bonus' })).toHaveClass('whitespace-nowrap');
    expect(screen.getByText(LAST)).toHaveClass('truncate');
    expect(screen.getByText(LAST)).toHaveAttribute('title', LAST);
    expect(screen.getByText('1,25,000 Bonus')).toHaveClass('shrink-0');
  });

  it('runs its action, by the mouse and by the keyboard', async () => {
    const onPress = vi.fn();
    renderIn(<SummaryStrip label="High hand bonus" lead="No hands paid tonight" action={{ label: 'Log a high hand', onPress }} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Log a high hand' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Log a high hand' }));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('has no button for someone who only reads it', () => {
    renderIn(<SummaryStrip label="High hand bonus" lead="2 hands paid tonight" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SummaryStrip label="High hand bonus" lead="2 hands paid tonight" facts={['15,000 Bonus']} detail={LAST}
      action={{ label: 'Log a high hand', onPress: () => undefined }} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
