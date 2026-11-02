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

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<StatRow stats={[{ label: 'This month', value: '2' }, { label: 'Hours played', value: '6h 30m' }]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
