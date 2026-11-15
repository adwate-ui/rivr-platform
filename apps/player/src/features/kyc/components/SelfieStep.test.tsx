import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelfieStep } from './SelfieStep.tsx';

afterEach(cleanup);

describe('Identity › Selfie', () => {
  it('reports why the camera did not start, by its kind (the trial run: sign-ups stopped here and nothing said why)', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    const onFailure = vi.fn();
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} onFailure={onFailure}>
        <SelfieStep onBack={() => undefined} onSent={() => undefined} />
      </RivrDataProvider>,
    );
    expect(await screen.findByRole('alert')).toBeDefined();
    // The report is made in an effect, which can run a moment after the alert is drawn.
    await waitFor(() => expect(onFailure.mock.calls).toEqual([['camera:none']]));
    // Once, and not again once everything has settled.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(onFailure.mock.calls).toHaveLength(1);
  });
});
