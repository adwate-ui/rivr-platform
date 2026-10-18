import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Stakes } from './Stakes.tsx';

describe('Stakes', () => {
  it('writes the blinds in rupees as small/big', () => {
    renderIn(<Stakes smallBlind={10_000n} bigBlind={20_000n} />);
    expect(screen.getByText('100/200')).toHaveClass('tabular-nums', 'whitespace-nowrap');
  });

  it('groups large blinds', () => {
    renderIn(<Stakes smallBlind={100_000n} bigBlind={200_000n} tone="muted" />);
    expect(screen.getByText('1,000/2,000')).toHaveClass('text-content-muted');
  });
});
