import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { CameraButton } from './CameraButton.tsx';

describe('CameraButton', () => {
  it('is a button named by its label that opens the front camera', async () => {
    const { container } = renderIn(<CameraButton onPhoto={() => undefined}>Take a selfie</CameraButton>);
    const input = container.querySelector('input[type="file"]');
    const opened = vi.fn();
    input?.addEventListener('click', opened);

    await userEvent.click(screen.getByRole('button', { name: 'Take a selfie' }));

    expect(opened).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute('capture', 'user');
    expect(input).toHaveAttribute('accept', 'image/*');
  });

  it('hands back the photo taken', async () => {
    const onPhoto = vi.fn();
    const { container } = renderIn(<CameraButton onPhoto={onPhoto}>Take a selfie</CameraButton>);
    const photo = new File(['jpeg'], 'selfie.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('no file input');

    await userEvent.upload(input, photo);

    expect(onPhoto).toHaveBeenCalledWith(photo);
  });

  it('is reached with Tab, pressed with Enter, and the hidden input is skipped', async () => {
    const { container } = renderIn(<CameraButton onPhoto={() => undefined}>Take a selfie</CameraButton>);
    const opened = vi.fn();
    container.querySelector('input[type="file"]')?.addEventListener('click', opened);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Take a selfie' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while the photo is sent', async () => {
    const { container } = renderIn(
      <CameraButton onPhoto={() => undefined} isLoading>
        Take a selfie
      </CameraButton>,
    );
    const opened = vi.fn();
    container.querySelector('input[type="file"]')?.addEventListener('click', opened);

    await userEvent.click(screen.getByRole('button'));

    expect(opened).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<CameraButton onPhoto={() => undefined}>Take a selfie</CameraButton>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
