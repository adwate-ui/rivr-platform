import type { Meta, StoryObj } from '@storybook/react-vite';
import { SocialCard } from './SocialCard.tsx';

// A card is a static render for @rivr/render: it has no loading, empty or error state.
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
    amountLabel: 'Guaranteed',
    details: ['Sunday 15 Nov 2026, 19:00', 'Buy-in ₹5,000'],
    venue: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram',
  },
} satisfies Meta<typeof SocialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Feed: Story = {};

export const StoryFormat: Story = { tags: ['viewport-story'], args: { format: 'story' } };

/** A promotion has no figure: the title is the hero. */
export const WithoutAmount: Story = {
  args: { label: 'Promotion', title: 'Double points', amountPaise: undefined, amountLabel: undefined, details: ['Thursday, 14:00 to 20:00', '100/200'] },
};

export const NoDetails: Story = { args: { label: 'Winner', title: 'Arjun M.', amountLabel: undefined, details: [] } };

export const LongText: Story = {
  args: {
    label: 'High hand',
    title: 'Straight flush, nine high, in the Private Room',
    amountPaise: 1_000_000n,
    amountLabel: undefined,
    details: ['Arjun M.', 'Table 3, Private Room', 'Sunday 15 Nov 2026, 01:12'],
    venue: 'Private Room entrance, upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram, Haryana 122018',
  },
};
