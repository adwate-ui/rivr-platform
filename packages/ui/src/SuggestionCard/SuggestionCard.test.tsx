import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { SuggestionCard } from './SuggestionCard.tsx';

describe('SuggestionCard', () => {
  it('is one button saying what it suggests and what pressing does', async () => {
    const onPress = vi.fn();
    renderIn(<SuggestionCard title="Your usual" text="Masala chai, Club sandwich" actionLabel="Add both" onPress={onPress} />);
    await userEvent.click(screen.getByRole('button', { name: /Your usual.*Masala chai, Club sandwich.*Add both/ }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<SuggestionCard title="Your usual" text="Masala chai" actionLabel="Add" onPress={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
