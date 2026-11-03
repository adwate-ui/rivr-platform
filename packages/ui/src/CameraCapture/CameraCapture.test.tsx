import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { blockedHelpOf, CameraCapture, troubleOf } from './CameraCapture.tsx';

const stop = vi.fn();
// What the camera hands back: its tracks, each of which can be stopped.
const stream = { getTracks: () => [{ stop }] };
const getUserMedia = vi.fn();

// Real browsers' user agents, as they name themselves.
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1';
const IPHONE_EDGE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/141.0.3537.71 Mobile/15E148 Safari/605.1.15';
const IPHONE_FIREFOX = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/144.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI = 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
// The Google app's own browser: no Version/, so not Safari.
const IPHONE_GOOGLE_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/390.0.787 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const ANDROID_WEB_VIEW = 'Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36';
const DESKTOP_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

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
    expect(await screen.findByText('Camera blocked. Allow it in site settings.')).toBeInTheDocument();
    // Blocked is this device's own setting to change: no QR code.
    expect(screen.queryByRole('img', { name: 'Link to this step on your phone' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Take photo' })).toBeInTheDocument();
  });

  it('on an iPhone, says to find the browser in Settings and allow the camera there', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_CHROME);
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    renderIn(<CameraCapture onPhoto={vi.fn()} />);
    expect(await screen.findByText('Camera blocked. In Settings, search for Chrome and allow Camera, then come back here.')).toBeInTheDocument();
  });

  it('says where to allow a blocked camera by phone and browser', () => {
    expect(blockedHelpOf(IPHONE_CHROME, false)).toContain('search for Chrome');
    expect(blockedHelpOf(IPHONE_EDGE, false)).toContain('search for Edge');
    expect(blockedHelpOf(IPHONE_FIREFOX, false)).toContain('search for Firefox');
    expect(blockedHelpOf(IPHONE_SAFARI, false)).toContain('search for Safari');
    expect(blockedHelpOf(IPAD_SAFARI, false)).toContain('search for Safari');
    expect(blockedHelpOf(ANDROID_CHROME, false)).toBe('Camera blocked. Tap the icon left of the address, then Permissions, allow Camera and tap Try again.');
    expect(blockedHelpOf(DESKTOP_CHROME, false)).toBe('Camera blocked. Allow it in site settings.');
  });

  it('keeps the general line where there is no one place to name: an app\'s own browser, or the installed app', () => {
    expect(blockedHelpOf(IPHONE_GOOGLE_APP, false)).toBe('Camera blocked. Allow it in site settings.');
    expect(blockedHelpOf(ANDROID_WEB_VIEW, false)).toBe('Camera blocked. Allow it in site settings.');
    expect(blockedHelpOf(IPHONE_SAFARI, true)).toBe('Camera blocked. Allow it in site settings.');
    expect(blockedHelpOf(ANDROID_CHROME, true)).toBe('Camera blocked. Allow it in site settings.');
  });

  it('on a device with no camera, offers a QR code to carry on with a phone', async () => {
    getUserMedia.mockRejectedValue(new DOMException('None', 'NotFoundError'));
    renderIn(<CameraCapture onPhoto={vi.fn()} phoneUrl="https://rivr.test/kyc" />);
    expect(await screen.findByText('No camera here. Carry on with a phone.')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Link to this step on your phone' })).toHaveAttribute('data-value', 'https://rivr.test/kyc');
  });

  it('offers no QR code when a camera is there but would not start: it is this device\'s to sort out', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Busy', 'NotReadableError'));
    renderIn(<CameraCapture onPhoto={vi.fn()} phoneUrl="https://rivr.test/kyc" />);
    expect(await screen.findByText('Camera did not start. Try again.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Link to this step on your phone' })).toBeNull();
  });

  it('shows why a photo was refused under it, between the photo and its buttons', async () => {
    getUserMedia.mockResolvedValue(stream);
    renderIn(<CameraCapture onPhoto={vi.fn()} error="Photo unclear. Retake it in good light." />);
    const take = screen.getByRole('button', { name: 'Take photo' });
    await waitFor(() => expect(take).toBeEnabled());
    await userEvent.click(take);
    expect(await screen.findByRole('alert')).toHaveTextContent('Photo unclear. Retake it in good light.');
    expect(screen.getByRole('button', { name: 'Use photo' })).toBeInTheDocument();
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
