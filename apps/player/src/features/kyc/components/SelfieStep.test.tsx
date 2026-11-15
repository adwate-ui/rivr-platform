import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { cleanup, render, screen } from '@testing-library/react';
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
    expect(onFailure.mock.calls).toEqual([['camera:none']]);
  });
});
