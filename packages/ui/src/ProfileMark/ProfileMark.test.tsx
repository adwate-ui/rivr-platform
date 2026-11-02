import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { ProfileMark } from './ProfileMark.tsx';

describe('ProfileMark', () => {
  it('shows the photo when there is one, else the initial', () => {
    const { rerender } = renderIn(<ProfileMark initial="I" />);
    expect(screen.getByText('I')).toBeDefined();
    rerender(<ProfileMark initial="I" photo={<img alt="Your photo" src="data:," />} />);
    expect(screen.getByRole('img', { name: 'Your photo' })).toBeDefined();
    expect(screen.queryByText('I')).toBeNull();
  });
});
