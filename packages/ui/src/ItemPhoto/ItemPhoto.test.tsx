import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { ItemPhoto } from './ItemPhoto.tsx';

describe('ItemPhoto', () => {
  it('shows the club\'s photo, hidden from screen readers as the name is beside it', () => {
    const { container } = renderIn(<ItemPhoto src="/media/chefs-menu.webp" name="Paneer tikka" />);
    const tile = container.firstElementChild;
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('img')).toHaveAttribute('src', '/media/chefs-menu.webp');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('shows the item\'s first letter until there is a photo', () => {
    const { container } = renderIn(<ItemPhoto src={null} name=" masala chai" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('M');
  });

  it('shows the first letter when the photo does not load, and tries a new photo again', () => {
    const { container, rerender } = renderIn(<ItemPhoto src="/media/gone.webp" name="RIVR hoodie" />);
    const photo = container.querySelector('img');
    if (photo === null) throw new Error('No photo');
    fireEvent.error(photo);
    expect(container.textContent).toBe('R');
    rerender(<ItemPhoto src="/media/chips.webp" name="RIVR hoodie" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/media/chips.webp');
  });
});
