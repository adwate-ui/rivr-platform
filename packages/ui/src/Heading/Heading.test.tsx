import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Heading } from './Heading.tsx';

describe('Heading', () => {
  it('renders the outline level it is given', () => {
    renderIn(<Heading level={1}>Balance</Heading>);
    expect(screen.getByRole('heading', { level: 1, name: 'Balance' })).toHaveClass('text-24', 'font-text');
  });

  it('picks a size from the level unless a variant is set', () => {
    renderIn(
      <>
        <Heading level={2}>Movements</Heading>
        <Heading level={3}>Markers</Heading>
      </>,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('text-20');
    expect(screen.getByRole('heading', { level: 3 })).toHaveClass('text-16');
  });

  it('sets the display variant in the display face at 56 px', () => {
    renderIn(
      <Heading level={1} variant="display" align="center">
        RIVR Sunday
      </Heading>,
    );
    expect(screen.getByRole('heading', { name: 'RIVR Sunday' })).toHaveClass('font-display', 'text-56', 'text-center');
  });

  it('sets the poster variant in the display face at its largest, for a social post with no figure', () => {
    renderIn(
      <Heading level={1} variant="poster">
        Double points
      </Heading>,
    );
    expect(screen.getByRole('heading', { name: 'Double points' })).toHaveClass('font-display', 'text-96');
  });

  it('sets a serif title in the display face at 36 px, or at the size asked (decision 0320)', () => {
    renderIn(<><Heading level={1} variant="serif">Sessions</Heading><Heading level={2} variant="serif" serifSize={32}>Top up</Heading></>);
    expect(screen.getByRole('heading', { name: 'Sessions' })).toHaveClass('font-display', 'text-36');
    expect(screen.getByRole('heading', { name: 'Top up' })).toHaveClass('font-display', 'text-32');
  });

  it('holds the optical size of a TV title low, and sets a code to type in the text face (D-01)', () => {
    renderIn(<><Heading level={1} variant="tvTitle">Call time</Heading><Heading level={2} variant="tvCode">482719</Heading></>);
    expect(screen.getByRole('heading', { name: 'Call time' }).className).toContain('optical-tv');
    expect(screen.getByRole('heading', { name: '482719' }).className).toContain('font-text');
  });

  it('can be heard by screen readers only, for a screen named by an image', () => {
    renderIn(
      <Heading level={1} isVisuallyHidden>
        Sign in
      </Heading>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toHaveClass('sr-only');
  });

  it('takes the focus as it opens, for a form opened below what opened it (F2-24)', () => {
    renderIn(<Heading level={3} isFocusedOnMount>Move Kabir Sethi</Heading>);
    expect(screen.getByRole('heading', { level: 3, name: 'Move Kabir Sethi' })).toHaveFocus();
  });

  it("sets a console card's name at 15 px in semibold (console v3)", () => {
    renderIn(<Heading level={2} variant="card">Table 1</Heading>);
    expect(screen.getByRole('heading', { level: 2, name: 'Table 1' })).toHaveClass('text-15', 'font-semibold');
  });
});
