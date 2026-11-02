import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { SheetPanel } from './SheetPanel.tsx';

describe('SheetPanel', () => {
  it('is a section named and headed by its title, with its aside', () => {
    renderIn(<SheetPanel title="All tables" aside="4 running"><p>rows</p></SheetPanel>);
    expect(screen.getByRole('region', { name: 'All tables' })).toHaveTextContent('rows');
    expect(screen.getByRole('heading', { name: 'All tables' })).toBeDefined();
    expect(screen.getByText('4 running')).toBeDefined();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SheetPanel title="All tables"><p>rows</p></SheetPanel>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
