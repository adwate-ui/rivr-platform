import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Text } from './Text.tsx';

describe('Text', () => {
  it('renders a paragraph of body copy by default', () => {
    renderIn(<Text>No sessions yet.</Text>);
    const text = screen.getByText('No sessions yet.');
    expect(text.tagName).toBe('P');
    expect(text).toHaveClass('font-text', 'text-16', 'text-content');
  });

  it('colours player money gold and secondary text muted', () => {
    renderIn(
      <>
        <Text tone="money">Bonus</Text>
        <Text tone="muted">Expires Sunday</Text>
      </>,
    );
    expect(screen.getByText('Bonus')).toHaveClass('text-money');
    expect(screen.getByText('Expires Sunday')).toHaveClass('text-content-muted');
  });

  it('sets TV labels in letter-spaced capitals', () => {
    renderIn(<Text variant="tvLabel">High hand</Text>);
    expect(screen.getByText('High hand')).toHaveClass('uppercase', 'tracking-tv');
  });

  it('sets social post labels in letter-spaced capitals at 36 px, legible once shrunk to a phone', () => {
    renderIn(<Text variant="posterLabel">Tournament</Text>);
    expect(screen.getByText('Tournament')).toHaveClass('uppercase', 'tracking-tv', 'text-36');
  });

  it('renders inline when asked and can truncate', () => {
    renderIn(
      <Text as="span" truncate id="seat">
        Seat 6
      </Text>,
    );
    const text = screen.getByText('Seat 6');
    expect(text.tagName).toBe('SPAN');
    expect(text).toHaveClass('truncate');
    expect(text).toHaveAttribute('id', 'seat');
  });
});
