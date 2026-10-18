import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Time } from './Time.tsx';

// 21:10 UTC on 14 Nov is 02:40 IST on the opening night.
const OPENING_NIGHT = new Date('2026-11-14T21:10:00Z');

describe('Time', () => {
  it('shows the 24-hour IST clock with the UTC instant as its datetime', () => {
    renderIn(<Time at={OPENING_NIGHT} />);
    const time = screen.getByText('02:40');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', '2026-11-14T21:10:00.000Z');
    expect(time).toHaveClass('tabular-nums');
  });

  it('can be muted and larger', () => {
    renderIn(<Time at={OPENING_NIGHT} tone="muted" size="lead" />);
    expect(screen.getByText('02:40')).toHaveClass('text-content-muted', 'text-18');
  });
});
