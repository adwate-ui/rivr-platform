import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Captcha } from './Captcha.tsx';

/** Cloudflare's Turnstile as the page would have it, recording what the widget asks of it. */
function fakeTurnstile() {
  const options: Record<string, unknown>[] = [];
  const turnstile = {
    render: vi.fn((_element: HTMLElement, given: Record<string, unknown>) => {
      options.push(given);
      return 'w1';
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  vi.stubGlobal('turnstile', turnstile);
  /** Calls the callback Turnstile was given under `name`, as Cloudflare would. */
  const fire = (name: string, ...args: unknown[]) => {
    const callback: unknown = options.at(-1)?.[name];
    if (typeof callback === 'function') act(() => void callback(...args));
  };
  return { turnstile, options, fire };
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const script of document.head.querySelectorAll('script')) script.remove();
});

/** The Cloudflare scripts the widget has added to the page. */
const cloudflareScripts = () => [...document.head.querySelectorAll<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]')];

describe('Captcha', () => {
  it('draws nothing, and asks Cloudflare nothing, without a site key', () => {
    const { turnstile } = fakeTurnstile();
    const { container } = render(<Captcha siteKey="" onToken={vi.fn()} />);
    expect(container.innerHTML).toBe('');
    expect(turnstile.render).not.toHaveBeenCalled();
  });

  it('asks for a check only when Cloudflare needs one, and hands over each token, or null when it lapses', async () => {
    const { options, fire } = fakeTurnstile();
    const onToken = vi.fn();
    render(<Captcha siteKey="0x4AAA" onToken={onToken} />);
    await vi.waitFor(() => expect(options).toHaveLength(1));
    expect(options[0]).toMatchObject({ sitekey: '0x4AAA', appearance: 'interaction-only', theme: 'dark' });
    fire('callback', 'token-1');
    fire('expired-callback');
    expect(onToken.mock.calls).toEqual([['token-1'], [null]]);
  });

  it('says when the check fails, and Try again draws it again, so sign-in is never stuck without a word', async () => {
    const { turnstile, options, fire } = fakeTurnstile();
    const onToken = vi.fn();
    render(<Captcha siteKey="0x4AAA" onToken={onToken} />);
    await vi.waitFor(() => expect(options).toHaveLength(1));
    fire('error-callback');
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('alert').textContent).toMatch(/^The security check failed/);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await vi.waitFor(() => expect(options).toHaveLength(2));
    expect(turnstile.remove).toHaveBeenCalledWith('w1');
    expect(screen.queryByRole('alert')).toBeNull();
    fire('callback', 'token-2');
    expect(onToken).toHaveBeenLastCalledWith('token-2');
  });

  it('says when the script cannot load, and Try again asks for it afresh, even after a page answered in its place', async () => {
    render(<Captcha siteKey="0x4AAA" onToken={vi.fn()} />);
    await vi.waitFor(() => expect(cloudflareScripts()).toHaveLength(1));
    // A network's block page answered: the script loaded, but no Turnstile came with it.
    act(() => void cloudflareScripts()[0]?.dispatchEvent(new Event('load')));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^The security check failed/);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await vi.waitFor(() => expect(cloudflareScripts()).toHaveLength(2));
    // Refused outright this time.
    act(() => void cloudflareScripts()[1]?.dispatchEvent(new Event('error')));
    expect(await screen.findByRole('alert')).toBeDefined();
    const { options } = fakeTurnstile();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await vi.waitFor(() => expect(options).toHaveLength(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('asks for a new token once the last one is used, and leaves nothing behind', async () => {
    const { turnstile, options } = fakeTurnstile();
    const onToken = vi.fn();
    const view = render(<Captcha siteKey="0x4AAA" onToken={onToken} renewKey={0} />);
    await vi.waitFor(() => expect(options).toHaveLength(1));
    view.rerender(<Captcha siteKey="0x4AAA" onToken={onToken} renewKey={1} />);
    expect(turnstile.reset).toHaveBeenCalledWith('w1');
    expect(onToken).toHaveBeenLastCalledWith(null);
    view.unmount();
    expect(turnstile.remove).toHaveBeenCalledWith('w1');
  });
});
