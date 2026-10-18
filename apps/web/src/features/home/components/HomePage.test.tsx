import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage.tsx';

describe('the website home page', () => {
  it('names the club and its opening', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'RIVR Poker Club' })).toBeDefined();
    expect(screen.getByText('Opens Sunday 15 November.')).toBeDefined();
  });
});
