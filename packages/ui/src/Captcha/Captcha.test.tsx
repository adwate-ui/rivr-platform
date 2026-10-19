import { act, render } from '@testing-library/react';
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
});

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
