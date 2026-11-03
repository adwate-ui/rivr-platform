import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PracticeBanner } from './PracticeBanner.tsx';

const MESSAGE = 'Practice venue: nothing here reaches the club or its members.';

describe('PracticeBanner', () => {
  it('is a striped region named for the practice venue, with its line and the way back', () => {
    renderIn(<PracticeBanner message={MESSAGE} action={{ label: 'Back to the club', onPress: vi.fn() }} />);
    const banner = screen.getByRole('region', { name: 'Practice venue' });
    expect(banner).toHaveAttribute('data-practice-stripes');
    expect(banner).toHaveTextContent(MESSAGE);
    expect(screen.getByRole('button', { name: 'Back to the club' })).toHaveClass('min-h-touch', 'tablet:min-h-7');
  });

  it('goes back to the club when asked', async () => {
    const onPress = vi.fn();
    renderIn(<PracticeBanner message={MESSAGE} action={{ label: 'Back to the club', onPress }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Back to the club' }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('holds the button while the switch is on its way', () => {
    renderIn(<PracticeBanner message={MESSAGE} action={{ label: 'Back to the club', onPress: vi.fn(), isPending: true }} />);
    expect(screen.getByRole('button', { name: 'Back to the club' })).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<PracticeBanner message={MESSAGE} action={{ label: 'Back to the club', onPress: vi.fn() }} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
