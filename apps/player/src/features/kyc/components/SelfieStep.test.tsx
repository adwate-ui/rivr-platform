import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelfieStep } from './SelfieStep.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// User agents as these browsers send them (Sentry, 16 Nov).
const INSTAGRAM_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 452.0.1.30.98 (iPhone16,2; iOS 26_6; en_IN; en; scale=3.00; 1290x2796; 0)';
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

function renderStep(onFailure = vi.fn()) {
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} onFailure={onFailure}>
      <ToastProvider><SelfieStep onBack={() => undefined} onSent={() => undefined} /></ToastProvider>
    </RivrDataProvider>,
  );
  return onFailure;
}

/** A browser that refuses the camera, as Instagram's does on an iPhone. */
function refuseCamera(userAgent: string) {
  const getUserMedia = vi.fn(async () => { throw new DOMException('Permission denied', 'NotAllowedError'); });
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  return getUserMedia;
}

describe('Identity › Selfie', () => {
  it('reports why the camera did not start, by its kind (the trial run: sign-ups stopped here and nothing said why)', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    const onFailure = renderStep();
    expect(await screen.findByRole('alert')).toBeDefined();
    // The report is made in an effect, which can run a moment after the alert is drawn.
    await waitFor(() => expect(onFailure.mock.calls).toEqual([['camera:none']]));
    // Once, and not again once everything has settled.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(onFailure.mock.calls).toHaveLength(1);
  });

  it('sends a member whose camera Instagram\'s browser refused to Safari, at this step\'s address', async () => {
    const writeText = vi.fn(async () => undefined);
    refuseCamera(INSTAGRAM_IPHONE);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onFailure = renderStep();

    expect(await screen.findByRole('heading', { name: 'Open RIVR in Safari' })).toBeDefined();
    expect(screen.getByText("Instagram's browser can't use your camera. Take your selfie there.")).toBeDefined();
    expect(onFailure.mock.calls).toEqual([['camera:blocked']]);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/kyc`));
  });

  it('tries the camera again on Continue here', async () => {
    const getUserMedia = refuseCamera(INSTAGRAM_IPHONE);
    renderStep();

    fireEvent.click(await screen.findByRole('button', { name: 'Continue here' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { name: 'Open RIVR in Safari' })).toBeDefined();
  });

  it('keeps the camera help in any other browser', async () => {
    refuseCamera(SAFARI_IPHONE);
    renderStep();

    expect((await screen.findByRole('alert')).textContent).toBe('Camera blocked. In Settings, search for Safari and allow Camera, then come back here.');
    expect(screen.queryByRole('heading', { name: 'Open RIVR in Safari' })).toBeNull();
  });
});
