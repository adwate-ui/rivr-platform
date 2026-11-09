import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { DocumentCamera } from './DocumentCamera.tsx';

const stream = { getTracks: () => [{ stop: () => undefined }], getVideoTracks: () => [] };
const getUserMedia = vi.fn();
const COVERS = [{ x: 0.2, y: 0.7, width: 0.3, height: 0.1 }];

beforeEach(() => {
  getUserMedia.mockReset();
  getUserMedia.mockResolvedValue(stream);
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { value: () => Promise.resolve(), configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 1920, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 1440, configurable: true });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: () => ({ drawImage: vi.fn(), fillRect: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(480 * 360 * 4) }) }),
    configurable: true,
  });
  let made = 0;
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    value: (done: (blob: Blob) => void) => {
      made += 1;
      done(new Blob([made === 1 ? 'taken' : 'covered'], { type: 'image/jpeg' }));
    },
    configurable: true,
  });
  vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 1800, height: 1135, close: () => undefined }));
  Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:card', configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function takePhoto() {
  await userEvent.click(await waitForShutter());
}

async function waitForShutter() {
  const shutter = await screen.findByRole('button', { name: 'Take photo' });
  await waitFor(() => expect(shutter.hasAttribute('disabled')).toBe(false));
  return shutter;
}

describe('DocumentCamera', () => {
  it('opens the back camera at a size that can read a card, and says what to do', async () => {
    renderIn(<DocumentCamera label="PAN card" onPhoto={vi.fn()} />);
    await waitForShutter();
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: 'environment', width: { ideal: 2560 } }) }));
    expect(screen.getByText('PAN card')).toBeDefined();
    expect(screen.getByText('Fit the card inside the outline.')).toBeDefined();
  });

  it('takes a photo with the shutter, shows it to check, and keeps it whole when no bars are asked for', async () => {
    const kept: Blob[] = [];
    renderIn(<DocumentCamera label="PAN card" onPhoto={(photo) => kept.push(photo)} />);
    await takePhoto();
    expect(await screen.findByRole('img', { name: 'PAN card' })).toBeDefined();
    expect(screen.getByText('Check every character can be read.')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    expect(kept).toHaveLength(1);
    expect(await kept[0]?.text()).toBe('taken');
  });

  it('goes back to the camera on Retake', async () => {
    const onPhoto = vi.fn();
    renderIn(<DocumentCamera label="PAN card" onPhoto={onPhoto} />);
    await takePhoto();
    await userEvent.click(await screen.findByRole('button', { name: 'Retake' }));
    expect(await screen.findByRole('button', { name: 'Take photo' })).toBeDefined();
    expect(onPhoto).not.toHaveBeenCalled();
  });

  it('opens a close look at the photo and back', async () => {
    renderIn(<DocumentCamera label="PAN card" onPhoto={vi.fn()} />);
    await takePhoto();
    await userEvent.click(await screen.findByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('img', { name: 'PAN card' }).className).toContain('max-w-none');
    await userEvent.click(screen.getByRole('button', { name: 'Show the whole card' }));
    expect(screen.getByRole('img', { name: 'PAN card' }).className).not.toContain('max-w-none');
  });

  it('opens the close look on the middle of the card', async () => {
    renderIn(<DocumentCamera label="PAN card" onPhoto={vi.fn()} />);
    await takePhoto();
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1800);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(340);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1135);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(215);
    await userEvent.click(await screen.findByRole('button', { name: 'Zoom in' }));
    const frame = screen.getByRole('img', { name: 'PAN card' }).parentElement;
    expect([frame?.scrollLeft, frame?.scrollTop]).toEqual([730, 460]);
  });

  it('names the card it is showing, so a wrong card is seen before it is kept', async () => {
    renderIn(<DocumentCamera label="PAN card" onPhoto={vi.fn()} />);
    await takePhoto();
    expect(await screen.findByText('Check every character can be read.')).toBeDefined();
    expect(screen.getByText('PAN card')).toBeDefined();
  });

  it('lets the keyboard reach the close look', async () => {
    renderIn(<DocumentCamera label="PAN card" onPhoto={vi.fn()} />);
    await takePhoto();
    await userEvent.click(await screen.findByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('group', { name: 'PAN card' }).tabIndex).toBe(0);
  });

  it('says when the photo could not be made, and the shutter still works', async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', { value: (done: (blob: Blob | null) => void) => done(null), configurable: true });
    renderIn(<DocumentCamera label="PAN card" onPhoto={vi.fn()} />);
    await takePhoto();
    expect(await screen.findByText('Photo not saved. Try again.')).toBeDefined();
    expect(await waitForShutter()).toBeDefined();
  });

  describe('which camera opened', () => {
    afterEach(() => Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true }));
    const opening = (facingMode: string | undefined, stop = vi.fn()) => {
      getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }], getVideoTracks: () => [{ getSettings: () => ({ facingMode }) }] });
      return stop;
    };

    it('sends a computer on to a phone, whatever its own camera could see', async () => {
      const stop = opening(undefined);
      renderIn(<DocumentCamera label="PAN card" onPhoto={vi.fn()} phoneUrl="https://console.example/kyc-review" />);
      expect(await screen.findByText('This device has no back camera. Carry on with a phone.')).toBeDefined();
      expect(screen.getByText('Scan with your phone to carry on there.')).toBeDefined();
      expect(stop).toHaveBeenCalled();
    });

    it('sends on a front camera even on a touch screen', async () => {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
      opening('user');
      renderIn(<DocumentCamera label="PAN card" onPhoto={vi.fn()} />);
      expect(await screen.findByText('This device has no back camera. Carry on with a phone.')).toBeDefined();
    });

    it('takes a back camera', async () => {
      opening('environment');
      renderIn(<DocumentCamera label="PAN card" onPhoto={vi.fn()} />);
      expect(await waitForShutter()).toBeDefined();
    });

    it('takes a phone that does not say which camera it opened', async () => {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
      opening(undefined);
      renderIn(<DocumentCamera label="PAN card" onPhoto={vi.fn()} />);
      expect(await waitForShutter()).toBeDefined();
    });
  });

  it('says what to do when the camera is blocked', async () => {
    getUserMedia.mockRejectedValue(new DOMException('', 'NotAllowedError'));
    renderIn(<DocumentCamera label="PAN card" onPhoto={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Camera blocked');
  });
});

describe('DocumentCamera with bars', () => {
  const confirm = 'The first eight digits are hidden';

  async function renderCovered() {
    const kept: Blob[] = [];
    renderIn(<DocumentCamera label="Aadhaar front" covers={COVERS} coverConfirm={confirm} onPhoto={(photo) => kept.push(photo)} />);
    await takePhoto();
    await screen.findByRole('button', { name: /^Bar 1/ });
    return kept;
  }

  it('keeps Use photo off until the bars are confirmed, then hands over only the covered copy', async () => {
    const kept = await renderCovered();
    const use = screen.getByRole('button', { name: 'Use photo' });
    expect(use.hasAttribute('disabled')).toBe(true);
    await userEvent.click(screen.getByRole('switch', { name: confirm }));
    expect(use.hasAttribute('disabled')).toBe(false);
    await userEvent.click(use);
    await waitFor(() => expect(kept).toHaveLength(1));
    expect(await kept[0]?.text()).toBe('covered');
  });

  it('asks again when a bar is moved after confirming, so a bar cannot be slid away unnoticed', async () => {
    await renderCovered();
    await userEvent.click(screen.getByRole('switch', { name: confirm }));
    fireEvent.keyDown(screen.getByRole('button', { name: /^Bar 1/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Use photo' }).hasAttribute('disabled')).toBe(true);
  });

  it('moves a bar with the arrow keys and resizes it with Shift', async () => {
    await renderCovered();
    const bar = screen.getByRole('button', { name: /^Bar 1/ });
    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(Number.parseFloat(bar.style.left)).toBeCloseTo(21, 5);
    fireEvent.keyDown(bar, { key: 'ArrowRight', shiftKey: true });
    expect(Number.parseFloat(bar.style.width)).toBeCloseTo(31, 5);
  });

  it('adds another bar for a number printed twice', async () => {
    await renderCovered();
    await userEvent.click(screen.getByRole('button', { name: 'Add another bar' }));
    expect(screen.getByRole('button', { name: /^Bar 2/ })).toBeDefined();
  });
});
