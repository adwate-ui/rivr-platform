import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Grid } from './Grid.tsx';

describe('Grid', () => {
  it('lays children out in equal columns', () => {
    renderIn(
      <Grid columns={3} as="ul" aria-label="Tables">
        <li>Table 1</li>
        <li>Table 2</li>
        <li>Table 3</li>
      </Grid>,
    );
    const grid = screen.getByRole('list', { name: 'Tables' });
    expect(grid).toHaveClass('grid', 'grid-cols-3', 'gap-4');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('takes a gap from the spacing scale', () => {
    renderIn(
      <Grid columns={2} gap={8} aria-label="Stats" as="ul">
        <li>Rake</li>
      </Grid>,
    );
    expect(screen.getByRole('list', { name: 'Stats' })).toHaveClass('grid-cols-2', 'gap-8');
  });
});
