import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { ProfileMark } from './ProfileMark.tsx';

describe('ProfileMark', () => {
  it('shows the photo filling the circle when there is one, else the initial', () => {
    const { rerender } = renderIn(<ProfileMark initial="I" />);
    expect(screen.getByText('I')).toBeDefined();
    rerender(<ProfileMark initial="I" photo="https://photos.test/me.jpg" />);
    const photo = screen.getByRole('img', { name: 'Your photo' });
    expect(photo).toHaveAttribute('src', 'https://photos.test/me.jpg');
    // Cropped to the circle, never fitted inside it with empty sides.
    expect(photo).toHaveClass('size-full', 'object-cover');
    expect(screen.queryByText('I')).toBeNull();
  });

  it('shows the initial when the photo cannot load, and tries a new address', () => {
    const { rerender } = renderIn(<ProfileMark initial="I" photo="https://photos.test/old.jpg" />);
    fireEvent.error(screen.getByRole('img', { name: 'Your photo' }));
    expect(screen.getByText('I')).toBeDefined();
    rerender(<ProfileMark initial="I" photo="https://photos.test/new.jpg" />);
    expect(screen.getByRole('img', { name: 'Your photo' })).toHaveAttribute('src', 'https://photos.test/new.jpg');
  });
});
