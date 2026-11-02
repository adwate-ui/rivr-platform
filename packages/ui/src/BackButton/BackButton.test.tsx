import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { BackButton } from './BackButton.tsx';

describe('BackButton', () => {
  it('names where it goes back to, and goes there', () => {
    const onBack = vi.fn();
    renderIn(<BackButton label="Tonight" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tonight' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
