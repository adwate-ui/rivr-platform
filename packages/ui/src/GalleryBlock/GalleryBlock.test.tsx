import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { GalleryBlock } from './GalleryBlock.tsx';

const ITEMS = [
  { image: '/media/dealers.webp', alt: 'A dealer deals at a table', title: 'Casino-trained dealers', text: 'Fast, accurate, fair.' },
  { image: '/media/cashier.webp', alt: 'A cashier counts chips at the cage', title: 'Instant, secure cashier' },
];

describe('GalleryBlock', () => {
  it('shows each tile with its still, described, its title and its line', () => {
    renderIn(<GalleryBlock heading="Built for the long session." items={ITEMS} note="Concept visualisation" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Built for the long session.' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'A dealer deals at a table' })).toHaveAttribute('src', '/media/dealers.webp');
    expect(screen.getByRole('heading', { level: 3, name: 'Instant, secure cashier' })).toBeInTheDocument();
    expect(screen.getByText('Fast, accurate, fair.')).toBeInTheDocument();
    expect(screen.getByText('Concept visualisation')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<GalleryBlock eyebrow="The RIVR difference" heading="Built for the long session." items={ITEMS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
