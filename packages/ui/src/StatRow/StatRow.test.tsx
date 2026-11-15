import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { StatRow } from './StatRow.tsx';

describe('StatRow', () => {
  it('pairs each stat with its name', () => {
    renderIn(<StatRow size="medium" stats={[{ label: 'Seats open', value: '3 of 9' }, { label: 'Waiting', value: 'None' }, { label: 'Call time', value: '3 h' }]} />);
    expect(screen.getByText('Seats open').closest('dl')).toHaveClass('grid-cols-3');
    expect(screen.getByText('3 of 9')).toHaveClass('text-20');
    expect(screen.getByText('Waiting').nextElementSibling).toHaveTextContent('None');
  });

  it('sets four stats, a report’s figures, two by two on a phone and in one row from 768 px', () => {
    renderIn(<StatRow stats={[{ label: 'Orders', value: '212' }, { label: 'Items', value: '318' }, { label: 'To accept', value: '2 min' }, { label: 'To serve', value: '9 min' }]} />);
    expect(screen.getByText('Orders').closest('dl')).toHaveClass('grid-cols-2', 'medium:grid-cols-4');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<StatRow stats={[{ label: 'This month', value: '2' }, { label: 'Hours played', value: '6h 30m' }]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
