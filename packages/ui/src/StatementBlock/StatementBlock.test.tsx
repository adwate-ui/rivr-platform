import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { StatementBlock } from './StatementBlock.tsx';

describe('StatementBlock', () => {
  it('sets its lines as one heading, each on its own line, with its action', () => {
    renderIn(<StatementBlock eyebrow="The RIVR difference" lines={['Not luck.', 'A game of skill.']} action={{ label: 'Join RIVR', href: '#sign-in' }} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Not luck.A game of skill.');
    expect(screen.getByText('The RIVR difference')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join RIVR' })).toHaveAttribute('href', '#sign-in');
  });

  it('puts its still behind the lines, as decoration only, and says what it is', () => {
    const { container } = renderIn(<StatementBlock lines={['Hold your nerve.']} image="/media/chips.webp" note="Concept visualisation" />);
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Concept visualisation')).toBeInTheDocument();
  });

  it('says nothing about a still it does not have', () => {
    renderIn(<StatementBlock lines={['Not luck.']} note="Concept visualisation" />);
    expect(screen.queryByText('Concept visualisation')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<StatementBlock lines={['Hold your nerve.']} text="Opens Sunday 15 November." image="/media/room.webp" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
