import type { Meta, StoryObj } from '@storybook/react-vite';
import { WebFooter } from './WebFooter.tsx';

// The footer is fixed copy: it has no loading, empty or error state.
const meta = {
  title: 'Website/WebFooter',
  component: WebFooter,
  tags: ['viewport-console'],
  parameters: { layout: 'padded' },
  args: {
    address: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram',
    notice: 'Strictly 18+. Poker is a game of skill.',
    links: [
      { label: '@rivr.pokerclub', href: 'https://www.instagram.com/rivr.pokerclub/' },
      { label: 'info@rivrpoker.com', href: 'mailto:info@rivrpoker.com' },
    ],
  },
} satisfies Meta<typeof WebFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };

export const WithoutLinks: Story = { args: { links: [] } };

export const LongText: Story = {
  args: { address: 'RIVR Poker Club, upper floor, Glaza Bar and Beyond, M3M 65th Avenue, Sector 65, Golf Course Extension Road, Gurugram, Haryana 122101' },
};
