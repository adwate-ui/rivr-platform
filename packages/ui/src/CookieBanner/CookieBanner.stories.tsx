import type { Meta, StoryObj } from '@storybook/react-vite';
import { CookieBanner } from './CookieBanner.tsx';

// The banner's words are fixed copy: it has no loading, empty or error state. Open, as a visitor with no choice sees it.
const meta = {
  title: 'Website/CookieBanner',
  component: CookieBanner,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: { isOpen: true },
} satisfies Meta<typeof CookieBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };
