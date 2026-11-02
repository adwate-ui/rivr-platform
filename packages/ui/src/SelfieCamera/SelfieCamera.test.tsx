import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { SelfieCamera } from './SelfieCamera.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A phone whose camera starts, as a fake stream. */
function cameraThatStarts() {
  const stream = { getTracks: () => [] };
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn(async () => stream) }, configurable: true });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
}

describe('Identity › Camera', () => {
  it('shows the oval, three tips and the shutter once the camera starts', async () => {
    cameraThatStarts();
    renderIn(<SelfieCamera onPhoto={() => undefined} onBack={() => undefined} />);
    expect(await screen.findByRole('button', { name: 'Take photo' })).toBeDefined();
    expect(screen.getByText('Even light')).toBeDefined();
    expect(screen.getByText('No cap or sunglasses')).toBeDefined();
    expect(screen.getByText('Only you')).toBeDefined();
    expect(document.querySelector('[data-oval="far"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
  });

  it('says what to do when the browser has no camera', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    renderIn(<SelfieCamera onPhoto={() => undefined} onBack={() => undefined} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No camera here. Carry on with a phone.');
  });
});
