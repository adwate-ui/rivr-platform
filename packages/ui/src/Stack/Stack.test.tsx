import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Stack } from './Stack.tsx';

describe('Stack', () => {
  it('stacks its children vertically with the default gap', () => {
    renderIn(
      <Stack aria-label="Tonight" as="section">
        <span>Table 1</span>
        <span>Table 2</span>
      </Stack>,
    );
    const stack = screen.getByRole('region', { name: 'Tonight' });
    expect(stack).toHaveClass('flex', 'flex-col', 'gap-4');
    expect(stack.children).toHaveLength(2);
  });

  it('can be a list and draw hairlines between items, padding them instead of a gap', () => {
    renderIn(
      <Stack as="ul" divided>
        <li>Table 1</li>
        <li>Table 2</li>
      </Stack>,
    );
    const list = screen.getByRole('list');
    expect(list).toHaveClass('divide-y', 'divide-hairline', '*:py-3');
    expect(list).not.toHaveClass('gap-4');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('aligns and distributes children', () => {
    renderIn(
      <Stack align="center" justify="between" aria-label="Centred" as="section">
        <span>A</span>
      </Stack>,
    );
    expect(screen.getByRole('region', { name: 'Centred' })).toHaveClass('items-center', 'justify-between');
  });
});
