import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { CameraCapture, troubleOf } from './CameraCapture.tsx';

const stop = vi.fn();
// What the camera hands back: its tracks, each of which can be stopped.
const stream = { getTracks: () => [{ stop }] };
const getUserMedia = vi.fn();

beforeEach(() => {
  stop.mockReset();
  getUserMedia.mockReset();
  vi.stubGlobal('isSecureContext', true);
  // jsdom has no camera, no video playback and no canvas: these stand in for the browser's.
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { value: () => Promise.resolve(), configurable: true });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => ({ translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn() }), configurable: true });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    value: (done: (blob: Blob) => void) => done(new Blob(['jpeg'], { type: 'image/jpeg' })),
    configurable: true,
  });
  Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:photo', configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CameraCapture', () => {
  it('opens the front camera for a selfie, never a file, and takes a photo to keep', async () => {
    getUserMedia.mockResolvedValue(stream);
    const onPhoto = vi.fn();
    renderIn(<CameraCapture hasFaceGuide onPhoto={onPhoto} />);
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: 'user' }) }));
    expect(document.querySelector('input[type="file"]')).toBeNull();
    const take = screen.getByRole('button', { name: 'Take photo' });
    await waitFor(() => expect(take).toBeEnabled());
    expect(screen.getByText('Fit your face in the oval.')).toBeInTheDocument();
    await userEvent.click(take);
    expect(await screen.findByRole('img', { name: 'Your photo' })).toHaveAttribute('src', 'blob:photo');
    // The camera goes off once the photo is taken.
    expect(stop).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    expect(onPhoto).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('opens the camera again to retake', async () => {
    getUserMedia.mockResolvedValue(stream);
    renderIn(<CameraCapture onPhoto={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Take photo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Retake' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Take photo' })).toBeEnabled();
  });

  it('says how to allow a blocked camera, and tries again', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError')).mockResolvedValue(stream);
    renderIn(<CameraCapture onPhoto={vi.fn()} phoneUrl="https://rivr.test/kyc" />);
    expect(await screen.findByText('Camera blocked. Allow it in the browser\'s site settings, then try again.')).toBeInTheDocument();
    // Blocked is the person's own setting: a phone would not help, so no QR code.
    expect(screen.queryByRole('img', { name: 'Link to this step on your phone' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Take photo' })).toBeInTheDocument();
  });

  it('on a device with no camera, offers a QR code to carry on with a phone', async () => {
    getUserMedia.mockRejectedValue(new DOMException('None', 'NotFoundError'));
    renderIn(<CameraCapture onPhoto={vi.fn()} phoneUrl="https://rivr.test/kyc" />);
    expect(await screen.findByText('No camera on this device.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Link to this step on your phone' })).toHaveAttribute('data-value', 'https://rivr.test/kyc');
  });

  it('opens the back camera for a photo taken at the desk', async () => {
    getUserMedia.mockResolvedValue(stream);
    renderIn(<CameraCapture facing="environment" onPhoto={vi.fn()} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: 'environment' }) })));
  });

  it('reads the browser\'s refusals as blocked, no camera, or failed', () => {
    expect(troubleOf(new DOMException('', 'NotAllowedError'))).toBe('blocked');
    expect(troubleOf(new DOMException('', 'NotFoundError'))).toBe('none');
    expect(troubleOf(new DOMException('', 'NotReadableError'))).toBe('failed');
    expect(troubleOf('odd')).toBe('failed');
  });
});
