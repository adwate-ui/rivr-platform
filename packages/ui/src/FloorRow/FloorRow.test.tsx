import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../Button/Button.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { FloorRow } from './FloorRow.tsx';

describe('FloorRow', () => {
  it('shows the table, its stakes as blinds, the waitlist line and the action', async () => {
    const { container } = renderIn(
      <FloorRow name="Table 3" smallBlind={10_000n} bigBlind={20_000n} detail="3 waiting" action={<Button variant="secondary">Join</Button>} />,
    );
    expect(screen.getByText('Table 3')).toBeInTheDocument();
    expect(screen.getByText('100/200')).toBeInTheDocument();
    expect(screen.getByText('3 waiting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no action for a closed table', () => {
    renderIn(<FloorRow name="Table 4" smallBlind={10_000n} bigBlind={20_000n} detail="Closed" isMuted />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
