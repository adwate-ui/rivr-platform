import type { Meta, StoryObj } from '@storybook/react-vite';
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
