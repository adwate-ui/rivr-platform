import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TOAST_MS, ToastProvider, UNDO_TOAST_MS, useToast } from './Toast.tsx';

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
    // The region stays, empty, so the next toast is announced as it comes.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('stays five seconds when it can be undone, so Undo can be pressed (console v3)', () => {
    vi.useFakeTimers();
    renderIn(<ToastProvider place="console"><Trigger onUndo={() => undefined} /></ToastProvider>);
    act(() => screen.getByRole('button', { name: 'Join' }).click());
    expect(UNDO_TOAST_MS).toBe(5000);
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS - TOAST_MS));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('keeps the player app\'s Undo to 3.2 seconds (decision 0320)', () => {
    vi.useFakeTimers();
    renderIn(<ToastProvider><Trigger onUndo={() => undefined} /></ToastProvider>);
    act(() => screen.getByRole('button', { name: 'Join' }).click());
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('undoes the action and goes when Undo is pressed', async () => {
    const onUndo = vi.fn();
    renderIn(<ToastProvider><Trigger onUndo={onUndo} /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('keeps its polite status region before any toast comes, so the first is announced too', () => {
    renderIn(<ToastProvider place="console"><Trigger /></ToastProvider>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('sits at the foot of the console, centred, and above the tab bar on a phone (console v3)', async () => {
    renderIn(<ToastProvider place="console"><Trigger /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByRole('status')).toHaveClass('justify-center', 'bottom-bottom-nav', 'medium:bottom-0');
    expect(screen.getByRole('status')).toHaveTextContent('Joined waitlist');
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
