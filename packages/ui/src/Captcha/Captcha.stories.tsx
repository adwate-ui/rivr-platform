import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Captcha } from './Captcha.tsx';

/**
 * Cloudflare Turnstile on the sign-in steps (#182). It only shows when Cloudflare needs the person
 * to do something, and never in Storybook: without a site key it draws nothing.
 */
const meta = {
  title: 'Controls/Captcha',
  component: Captcha,
  args: { siteKey: '', onToken: () => undefined },
} satisfies Meta<typeof Captcha>;

export default meta;

type Story = StoryObj<typeof meta>;

/** No site key: a local stack, or before the owner adds one. Nothing is drawn. */
export const Default: Story = {};

/** The check could not load or failed, as when Cloudflare is blocked: it says so, with Try again. */
export const Failed: Story = {
  args: { siteKey: '0x4AAA' },
  beforeEach: () => {
    Reflect.set(window, 'turnstile', {
      render: (_element: HTMLElement, options: Record<string, unknown>) => {
        const failed = options['error-callback'];
        if (typeof failed === 'function') queueMicrotask(() => void failed());
        return 'w1';
      },
      reset: () => undefined,
      remove: () => undefined,
    });
    return () => void Reflect.deleteProperty(window, 'turnstile');
  },
  // The failure comes a moment after the check is drawn: the story waits for it, so its picture is always the failure.
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('alert')).toBeInTheDocument();
  },
};
