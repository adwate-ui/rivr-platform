import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { MapBlock } from './MapBlock.tsx';

const DIRECTIONS = 'https://www.google.com/maps/search/?api=1&query=Glaza%2C%20M3M%2065th%20Avenue%2C%20Gurugram';

describe('MapBlock', () => {
  it('gives the address and hours, and links to directions without embedding a map', () => {
    const { container } = renderIn(
      <MapBlock heading="Find us" address="Upper floor, Glaza, M3M 65th Avenue, Gurugram" hours="Open 14:00 to 08:00." directionsUrl={DIRECTIONS} />,
    );
    expect(container.querySelector('address')).toHaveTextContent('Upper floor, Glaza, M3M 65th Avenue, Gurugram');
    expect(screen.getByText('Open 14:00 to 08:00.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get directions' })).toHaveAttribute('href', DIRECTIONS);
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<MapBlock address="Upper floor, Glaza, M3M 65th Avenue, Gurugram" directionsUrl={DIRECTIONS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
