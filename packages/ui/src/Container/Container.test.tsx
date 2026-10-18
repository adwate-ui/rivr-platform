import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Container } from './Container.tsx';

describe('Container', () => {
  it('centres its content with side padding at full width by default', () => {
    renderIn(<Container>Tonight</Container>);
    expect(screen.getByText('Tonight')).toHaveClass('mx-auto', 'w-full', 'px-4');
  });

  it('caps the width at a line of text or a target device', () => {
    renderIn(
      <>
        <Container width="text">House rules</Container>
        <Container width="phone" paddingX={0}>
          Player
        </Container>
      </>,
    );
    expect(screen.getByText('House rules')).toHaveClass('max-w-text');
    expect(screen.getByText('Player')).toHaveClass('max-w-phone', 'px-0');
  });
});
