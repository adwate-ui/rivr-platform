import { screen } from '@testing-library/react';
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

  it('shows a profile icon before the member is known', () => {
    const { container } = renderIn(<AvatarLink href="/profile" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<AvatarLink initial="I" href="/profile" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
