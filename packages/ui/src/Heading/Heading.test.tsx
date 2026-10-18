import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Heading } from './Heading.tsx';

describe('Heading', () => {
  it('renders the outline level it is given', () => {
    renderIn(<Heading level={1}>Balance</Heading>);
    expect(screen.getByRole('heading', { level: 1, name: 'Balance' })).toHaveClass('text-24', 'font-text');
  });

  it('picks a size from the level unless a variant is set', () => {
    renderIn(
      <>
        <Heading level={2}>Movements</Heading>
        <Heading level={3}>Markers</Heading>
      </>,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('text-20');
    expect(screen.getByRole('heading', { level: 3 })).toHaveClass('text-16');
  });

  it('sets the display variant in the display face at 56 px', () => {
    renderIn(
      <Heading level={1} variant="display" align="center">
        RIVR Sunday
      </Heading>,
    );
    expect(screen.getByRole('heading', { name: 'RIVR Sunday' })).toHaveClass('font-display', 'text-56', 'text-center');
  });
});
