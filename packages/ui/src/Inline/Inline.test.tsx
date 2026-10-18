import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Inline } from './Inline.tsx';

describe('Inline', () => {
  it('lays children out in a row, centred, with the default gap', () => {
    renderIn(
      <Inline as="ul" aria-label="Stakes">
        <li>50/100</li>
        <li>100/200</li>
      </Inline>,
    );
    const row = screen.getByRole('list', { name: 'Stakes' });
    expect(row).toHaveClass('flex', 'flex-row', 'items-center', 'gap-2');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('wraps and spreads children when asked', () => {
    renderIn(
      <Inline wrap justify="between" gap={4} aria-label="Row" as="ul">
        <li>A</li>
      </Inline>,
    );
    expect(screen.getByRole('list', { name: 'Row' })).toHaveClass('flex-wrap', 'justify-between', 'gap-4');
  });
});
