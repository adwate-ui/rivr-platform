import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { AvatarLink } from './AvatarLink.tsx';

describe('AvatarLink', () => {
  it('opens Profile from the member initial through the router', async () => {
    const onNavigate = vi.fn();
    renderIn(<AvatarLink initial="I" href="/profile" onNavigate={onNavigate} />);
    const link = screen.getByRole('link', { name: 'Profile' });
    expect(link).toHaveTextContent('I');
    expect(link).toHaveClass('size-touch', 'rounded-full');
    await userEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('/profile');
  });

  it('shows the member photo filling the circle, and the initial when it cannot load', () => {
    const { container } = renderIn(<AvatarLink initial="I" photo="https://photos.test/me.jpg" href="/profile" />);
    const link = screen.getByRole('link', { name: 'Profile' });
    const photo = container.querySelector('img');
    if (photo === null) throw new Error('the photo is not shown');
    expect(photo).toHaveAttribute('src', 'https://photos.test/me.jpg');
    // Cropped to the circle, never fitted inside it with empty sides.
    expect(photo).toHaveClass('size-full', 'object-cover');
    expect(link).toHaveClass('overflow-hidden');
    expect(link).not.toHaveTextContent('I');
    fireEvent.error(photo);
    expect(link).toHaveTextContent('I');
  });

  it('shows a profile icon before the member is known', () => {
    const { container } = renderIn(<AvatarLink href="/profile" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('has no accessibility violations, with the initial or the photo', async () => {
    const { container, rerender } = renderIn(<AvatarLink initial="I" href="/profile" />);
    expect(await axeViolations(container)).toEqual([]);
    rerender(<AvatarLink initial="I" photo="https://photos.test/me.jpg" href="/profile" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
