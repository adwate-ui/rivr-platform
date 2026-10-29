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

  it('gives the club’s number to call and email to write to, when it has them (decision 0166)', () => {
    renderIn(<MapBlock address="Glaza" directionsUrl={DIRECTIONS} phone="+919000000000" email="info@rivrpoker.com" />);
    expect(screen.getByRole('link', { name: '+91 90000 00000' })).toHaveAttribute('href', 'tel:+919000000000');
    expect(screen.getByRole('link', { name: 'info@rivrpoker.com' })).toHaveAttribute('href', 'mailto:info@rivrpoker.com');
  });

  it('holds an embedded map back until the visitor allows maps: the frame has no address, and a button asks', () => {
    const embed = 'https://www.google.com/maps?q=Glaza&output=embed';
    const { container } = renderIn(<MapBlock address="Glaza" directionsUrl={DIRECTIONS} embedUrl={embed} />);
    const frame = container.querySelector('iframe');
    expect(frame).toHaveAttribute('data-consent-src', embed);
    expect(frame).not.toHaveAttribute('src');
    expect(frame).toHaveAttribute('hidden');
    expect(screen.getByRole('button', { name: 'Allow maps' })).toHaveAttribute('data-consent-allow', 'maps');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<MapBlock address="Upper floor, Glaza, M3M 65th Avenue, Gurugram" directionsUrl={DIRECTIONS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
