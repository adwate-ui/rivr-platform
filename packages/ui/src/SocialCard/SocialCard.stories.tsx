import type { Meta, StoryObj } from '@storybook/react-vite';
import { SocialCard } from './SocialCard.tsx';

const meta = {
  title: 'Social/SocialCard',
  component: SocialCard,
  tags: ['viewport-feed'],
  parameters: { layout: 'fullscreen' },
  args: {
    format: 'feed',
    label: 'Tournament',
    title: 'RIVR Sunday',
    amountPaise: 50_000_000n,
    details: ['Sunday 15 November, 19:00', 'Buy-in ₹5,000'],
    venue: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram',
  },
} satisfies Meta<typeof SocialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Feed: Story = {};

export const StoryFormat: Story = { tags: ['viewport-story'], args: { format: 'story' } };

/** A promotion has no figure. */
export const WithoutAmount: Story = {
  args: { label: 'Promotion', title: 'Double points', amountPaise: undefined, details: ['Thursday, 14:00 to 20:00', '100/200'] },
};

export const LongText: Story = {
  args: {
    label: 'High hand',
    title: 'Straight flush, nine high, in the Private Room',
    amountPaise: 1_000_000n,
    details: ['Arjun M.', 'Table 3, Private Room', 'Sunday 15 November, 01:12'],
  },
};
