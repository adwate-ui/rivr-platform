import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { FeatureBlock } from './FeatureBlock.tsx';

const PROPS = {
  eyebrow: 'The RIVR app',
  heading: 'Done waiting for a seat?',
  points: ['Live tables', 'The waitlist'],
  action: { label: 'Join RIVR', href: '#sign-in' },
  image: '/media/app-home.webp',
  alt: 'The RIVR app\'s Home',
};

describe('FeatureBlock', () => {
  it('shows its picture, described, beside its heading, points and action', () => {
    renderIn(<FeatureBlock {...PROPS} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Done waiting for a seat?' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'The RIVR app\'s Home' })).toHaveAttribute('src', '/media/app-home.webp');
    expect(screen.getByText('Live tables')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join RIVR' })).toHaveAttribute('href', '#sign-in');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<FeatureBlock {...PROPS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
