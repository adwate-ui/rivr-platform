import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TextBlock } from './TextBlock.tsx';

describe('TextBlock', () => {
  it('shows its heading and one paragraph for each blank-line break', () => {
    renderIn(<TextBlock heading="A members' club" body={'Cash games every night.\n\nTournaments on the weekend.'} />);
    expect(screen.getByRole('heading', { level: 2, name: "A members' club" })).toBeInTheDocument();
    expect(screen.getByText('Cash games every night.')).toBeInTheDocument();
    expect(screen.getByText('Tournaments on the weekend.')).toBeInTheDocument();
  });

  it('has no heading when it has none', () => {
    renderIn(<TextBlock body="Training only." />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TextBlock heading="A members' club" body="Cash games every night." />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
