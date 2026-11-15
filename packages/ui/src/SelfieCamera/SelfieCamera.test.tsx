import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { SelfieCamera } from './SelfieCamera.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A phone whose camera starts, as a fake stream. */
function cameraThatStarts() {
  const stream = { getTracks: () => [] };
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn(async () => stream) }, configurable: true });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
}

describe('Identity › Camera', () => {
  it('on an iPhone whose browser blocked the camera, says where to allow it', async () => {
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(async () => { throw new DOMException('Denied', 'NotAllowedError'); }) },
      configurable: true,
    });
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1');
    renderIn(<SelfieCamera onPhoto={() => undefined} onBack={() => undefined} />);
    expect(await screen.findByText('Camera blocked. In Settings, search for Chrome and allow Camera, then come back here.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

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

  it('sets "Selfie" in the middle of three equal columns, centred whatever Back\'s width (owner, 3 Nov)', async () => {
    cameraThatStarts();
    renderIn(<SelfieCamera onPhoto={() => undefined} onBack={() => undefined} />);
    const title = await screen.findByText('Selfie');
    expect(title).toHaveClass('justify-self-center');
    expect(title.parentElement).toHaveClass('grid', 'grid-cols-3');
  });

  it('says what to do when the browser has no camera, and tells the app which kind of trouble it was', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    const onTrouble = vi.fn();
    renderIn(<SelfieCamera onPhoto={() => undefined} onBack={() => undefined} onTrouble={onTrouble} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No camera here. Carry on with a phone.');
    // Told once the screen has drawn, which on a busy machine is a moment after the words are there.
    await waitFor(() => expect(onTrouble.mock.calls).toEqual([['none']]));
  });

  it('tells the app when a photo could not be made, as the screen itself shows nothing then', async () => {
    cameraThatStarts();
    // jsdom has no canvas to draw on, as a phone short of memory has none.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onTrouble = vi.fn();
    renderIn(<SelfieCamera onPhoto={() => undefined} onBack={() => undefined} onTrouble={onTrouble} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Take photo' }));
    await waitFor(() => expect(onTrouble.mock.calls).toEqual([['photo']]));
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeDefined();
  });
});
