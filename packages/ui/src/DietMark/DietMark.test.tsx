import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DietMark } from './DietMark.tsx';

describe('DietMark', () => {
  it.each([['veg', 'Vegetarian'], ['egg', 'Contains egg'], ['non_veg', 'Non-vegetarian']] as const)('names %s in words', (diet, name) => {
    renderIn(<DietMark diet={diet} />);
    expect(screen.getByRole('img', { name })).toBeInTheDocument();
  });

  it('tells non-veg by its shape, a triangle where the others have a dot', () => {
    const { container, rerender } = renderIn(<DietMark diet="non_veg" />);
    expect(container.querySelector('path')).not.toBeNull();
    expect(container.querySelector('circle')).toBeNull();
    rerender(<DietMark diet="veg" />);
    expect(container.querySelector('circle')).not.toBeNull();
    expect(container.querySelector('path')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<DietMark diet="egg" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
