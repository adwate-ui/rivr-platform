import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { BRAND_ICON_NAMES, BrandIcon } from './BrandIcon.tsx';

describe('BrandIcon', () => {
  it('draws each brand mark filled in the text colour at the icon size, hidden when unnamed', () => {
    const { container } = renderIn(<BrandIcon name="whatsapp" size="sm" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg).toHaveAttribute('width', '16');
    expect(BRAND_ICON_NAMES).toEqual(['whatsapp', 'instagram', 'youtube']);
  });

  it('is announced as an image when it is named', () => {
    renderIn(<BrandIcon name="instagram" label="Instagram" />);
    expect(screen.getByRole('img', { name: 'Instagram' })).toBeInTheDocument();
  });
});
