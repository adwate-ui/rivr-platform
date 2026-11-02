import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { RoundAction } from './RoundAction.tsx';

describe('RoundAction', () => {
  it('is a button named by its label', async () => {
    const onPress = vi.fn();
    renderIn(<RoundAction icon="addTime" label="Add time" onPress={onPress} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add time' }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('dims and ignores presses while its request is pending', async () => {
    const onPress = vi.fn();
    renderIn(<RoundAction icon="topUp" label="Top up" onPress={onPress} isPending />);
    const button = screen.getByRole('button', { name: 'Top up' });
    await userEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveClass('opacity-disabled');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<RoundAction icon="leave" label="Leave seat" onPress={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
