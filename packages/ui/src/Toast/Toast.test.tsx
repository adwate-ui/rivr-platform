import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TOAST_MS, ToastProvider, useToast } from './Toast.tsx';

function Trigger({ onUndo }: { onUndo?: () => void }) {
  const toast = useToast();
  return <button type="button" onClick={() => toast('Joined waitlist', onUndo ? { onUndo } : undefined)}>Join</button>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('confirms the action politely and goes after 3.2 seconds', () => {
    vi.useFakeTimers();
    renderIn(<ToastProvider><Trigger /></ToastProvider>);
    act(() => screen.getByRole('button', { name: 'Join' }).click());
    expect(screen.getByRole('status')).toHaveTextContent('Joined waitlist');
    expect(TOAST_MS).toBe(3200);
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('undoes the action and goes when Undo is pressed', async () => {
    const onUndo = vi.fn();
    renderIn(<ToastProvider><Trigger onUndo={onUndo} /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('needs a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderIn(<Trigger />)).toThrow('ToastProvider');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<ToastProvider><Trigger onUndo={() => undefined} /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await axeViolations(container)).toEqual([]);
  });
});
