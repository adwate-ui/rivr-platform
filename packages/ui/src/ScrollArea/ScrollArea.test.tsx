import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ScrollArea } from './ScrollArea.tsx';

describe('ScrollArea', () => {
  it('names its scrolling region', () => {
    renderIn(
      <ScrollArea label="Movements">
        <p>Buy-in ₹10,000</p>
      </ScrollArea>,
    );
    expect(screen.getByRole('region', { name: 'Movements' })).toHaveTextContent('Buy-in ₹10,000');
  });

  it('takes keyboard focus so the keys can scroll it', async () => {
    renderIn(
      <ScrollArea label="Movements">
        <p>Cash-out ₹22,500</p>
      </ScrollArea>,
    );
    await userEvent.tab();
    expect(screen.getByRole('region', { name: 'Movements' })).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(
      <ScrollArea label="Movements">
        <p>Deposit ₹5,000</p>
      </ScrollArea>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
