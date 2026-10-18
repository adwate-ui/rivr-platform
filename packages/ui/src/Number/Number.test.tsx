import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Number } from './Number.tsx';

describe('Number', () => {
  it('groups a count the Indian way with tabular figures', () => {
    renderIn(<Number value={1_234_567} />);
    expect(screen.getByText('12,34,567')).toHaveClass('tabular-nums', 'text-content');
  });

  it('accepts bigint counts and a muted tone', () => {
    renderIn(<Number value={18_420n} tone="muted" size="title" />);
    expect(screen.getByText('18,420')).toHaveClass('text-content-muted', 'text-28');
  });
});
