import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { StoryBlock } from './StoryBlock.tsx';

const PROPS = {
  heading: 'Good hands. Better company.',
  paragraphs: ['RIVR opens on Sunday 15 November.'],
  figures: [{ value: '6', label: 'Tables' }],
  image: '/media/room.webp',
  alt: 'The main room at RIVR',
};

describe('StoryBlock', () => {
  it('tells the story beside its photo, with its figures', () => {
    renderIn(<StoryBlock {...PROPS} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Good hands. Better company.' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'The main room at RIVR' })).toBeInTheDocument();
    expect(screen.getByRole('definition')).toHaveTextContent('6');
    expect(screen.getByRole('term')).toHaveTextContent('Tables');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<StoryBlock {...PROPS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
