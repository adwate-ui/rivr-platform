import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SelfieTips } from './SelfieTips.tsx';

afterEach(cleanup);

describe('SelfieTips', () => {
  it('says how to take a selfie that passes, and that a check keeps one (issue 720)', () => {
    render(<SelfieTips />);
    expect(screen.getByRole('heading', { level: 2, name: 'Selfie tips' })).toBeDefined();
    for (const tip of ['Good, even light on your face.', 'Look straight at the camera.', 'No cap, mask or sunglasses.', 'Only you in the photo.',
      'It is your one selfie for this check.']) {
      expect(screen.getByText(tip)).toBeDefined();
    }
  });
});
