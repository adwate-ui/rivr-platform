import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Divider } from './Divider.tsx';

describe('Divider', () => {
  it('is a horizontal separator drawn as a gold hairline', () => {
    renderIn(<Divider />);
    const rule = screen.getByRole('separator');
    expect(rule.tagName).toBe('HR');
    expect(rule).toHaveClass('border-t', 'border-hairline');
  });

  it('can run vertically between items in a row', () => {
    renderIn(<Divider orientation="vertical" />);
    const rule = screen.getByRole('separator');
    expect(rule).toHaveAttribute('aria-orientation', 'vertical');
    expect(rule).toHaveClass('border-l', 'border-hairline');
  });
});
