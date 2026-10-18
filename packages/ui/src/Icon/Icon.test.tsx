import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { ICON_NAMES, Icon } from './Icon.tsx';

describe('Icon', () => {
  it('is hidden from screen readers when it has no label', () => {
    const { container } = renderIn(<Icon name="home" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('is announced as an image when it carries meaning', () => {
    renderIn(<Icon name="offline" label="Offline" />);
    expect(screen.getByRole('img', { name: 'Offline' })).toBeInTheDocument();
  });

  it('draws at the token size with a 1.5 px stroke that does not scale', () => {
    const { container } = renderIn(<Icon name="lock" size="sm" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('stroke-width', '1.5');
    expect(container.querySelector('[vector-effect="non-scaling-stroke"]')).not.toBeNull();
  });

  it('has the icons the tab bar, rail and states need', () => {
    expect(ICON_NAMES).toEqual(
      expect.arrayContaining(['home', 'sessions', 'balance', 'rewards', 'learn', 'profile', 'close', 'lock', 'alert', 'offline']),
    );
  });
});
