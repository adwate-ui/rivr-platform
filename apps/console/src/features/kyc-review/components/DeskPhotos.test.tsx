import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeskCamera } from './DeskPhotos.tsx';
import { stubCamera } from './inPersonTestApi.tsx';

beforeEach(stubCamera);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the member\'s photo at the desk', () => {
  it('says a photo could not be made, and reports it by its kind', async () => {
    // As on a tablet short of memory: the canvas gives no photo.
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(null));
    const onFailure = vi.fn();
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} onFailure={onFailure}>
        <DeskCamera kind="face" place={1} total={3} hasCovers={false} onPhoto={vi.fn()} />
      </RivrDataProvider>,
    );
    const take = await screen.findByRole('button', { name: 'Take photo' });
    await waitFor(() => expect(take.hasAttribute('disabled')).toBe(false));
    fireEvent.click(take);
    expect((await screen.findByRole('alert')).textContent).toBe('Photo not taken. Try again.');
    expect(onFailure.mock.calls).toEqual([['camera:photo']]);
  });
});
