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
    copyright: 'Copyright 2026 RIVR Poker Club',
    cookieSettings: 'Cookie settings',
    columns: [
      { heading: 'The club', links: [{ label: 'Our story', href: '/about' }, { label: 'The room', href: '/#the-room' }, { label: 'Membership', href: '/membership' }] },
      { heading: 'Play', links: [{ label: 'Games', href: '/#games' }, { label: 'Leaderboard', href: '/leaderboard' }, { label: 'Tournaments', href: '/tournaments' }] },
      { heading: 'Policies', links: [{ label: 'House rules', href: '/house-rules' }, { label: 'Legal standing', href: '/about#legal' }, { label: 'Privacy', href: '/privacy' }] },
      { heading: 'Need to talk?', links: [{ label: 'Tele-MANAS 14416 (24 hours)', href: 'tel:14416' }, { label: 'iCall 91529 87821', href: 'tel:+919152987821' }] },
    ],
  },
} satisfies Meta<typeof WebFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };

export const WithoutLinks: Story = { args: { columns: [], cookieSettings: undefined } };

export const LongText: Story = {
  args: { address: 'RIVR Poker Club, upper floor, Glaza Bar and Beyond, M3M 65th Avenue, Sector 65, Golf Course Extension Road, Gurugram, Haryana 122101' },
};
