import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TableBlock } from './TableBlock.tsx';

const PROPS = { heading: 'Points an hour', columns: ['Stake', 'Points an hour'], rows: [['NLH 50/100', '5'], ['NLH 100/200', '10']] };

describe('TableBlock', () => {
  it('names each column and each row', () => {
    renderIn(<TableBlock {...PROPS} />);
    expect(screen.getByRole('columnheader', { name: 'Points an hour' })).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /NLH 100\/200/ });
    expect(within(row).getByRole('rowheader', { name: 'NLH 100/200' })).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: '10' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TableBlock {...PROPS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
