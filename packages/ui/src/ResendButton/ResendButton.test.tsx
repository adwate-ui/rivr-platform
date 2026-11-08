import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ResendButton } from './ResendButton.tsx';

afterEach(() => {
  vi.useRealTimers();
});

describe('ResendButton', () => {
  it('counts the minute down in minutes and seconds, then offers a new code', () => {
    vi.useFakeTimers();
    renderIn(<ResendButton onResend={async () => true} isLoading={false} />);
    expect(screen.getByRole('button', { name: 'Resend code in 1:00' })).toBeDisabled();
    act(() => { vi.advanceTimersByTime(36_000); });
    expect(screen.getByRole('button', { name: 'Resend code in 0:24' })).toBeDisabled();
    act(() => { vi.advanceTimersByTime(24_000); });
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled();
  });

  it('starts the minute again once a code has gone, and not when it failed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onResend = vi.fn<() => Promise<boolean>>().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderIn(<ResendButton onResend={onResend} isLoading={false} />);
    act(() => { vi.advanceTimersByTime(60_000); });
    await userEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    expect(await screen.findByRole('button', { name: /^Resend code in / })).toBeDisabled();
    expect(onResend).toHaveBeenCalledTimes(2);
  });

  it('waits for what else holds it back, such as the captcha', () => {
    vi.useFakeTimers();
    renderIn(<ResendButton onResend={async () => true} isLoading={false} isDisabled />);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<ResendButton onResend={async () => true} isLoading={false} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
