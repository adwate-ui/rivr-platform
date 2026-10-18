import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Box } from './Box.tsx';

describe('Box', () => {
  it('renders its children in a div by default', () => {
    renderIn(<Box>Table 3</Box>);
    expect(screen.getByText('Table 3').tagName).toBe('DIV');
  });

  it('renders the landmark it is asked for, with its accessible name', () => {
    renderIn(
      <Box as="section" aria-label="Tonight">
        Five tables open
      </Box>,
    );
    expect(screen.getByRole('region', { name: 'Tonight' })).toHaveTextContent('Five tables open');
  });

  it('draws surfaces and hairlines from the token theme only', () => {
    renderIn(
      <Box surface="raised" hairline="bottom" padding={4} radius="lg">
        Row
      </Box>,
    );
    expect(screen.getByText('Row')).toHaveClass('bg-raised', 'border-b', 'border-hairline', 'p-4', 'rounded-lg');
  });

  it('adds no class attribute when nothing is set', () => {
    renderIn(<Box>Plain</Box>);
    expect(screen.getByText('Plain')).not.toHaveAttribute('class');
  });
});
