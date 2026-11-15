import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeroBlock } from './HeroBlock.tsx';

const meta = {
  title: 'Website/HeroBlock',
  component: HeroBlock,
  // Shot as a visitor who asks for less motion sees it: the loop's still.
  tags: ['viewport-console', 'reduced-motion'],
  parameters: { layout: 'fullscreen' },
  args: {
    eyebrow: 'RIVR Poker Club · Gurugram',
    heading: 'Bring your poker face.',
    text: 'A members\' poker club at Glaza, M3M 65th Avenue. Dealers at every table, a cage that pays out the same night, and a floor you follow from your phone. Opens Sunday 15 November.',
    action: { label: 'Join RIVR', href: '#sign-in' },
    video: { src: '/media/hero-room.mp4', poster: '/media/hero-room.webp' },
    note: 'Concept visualisation',
  },
} satisfies Meta<typeof HeroBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };

// A word wider than a phone breaks inside the heading rather than scroll the page sideways (#621).
export const LongWordOnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'], args: { heading: 'Internationalisation nights', video: undefined, note: undefined } };

export const WithoutVideo: Story = { args: { eyebrow: undefined, heading: 'Sunday tournament', text: 'Cards in the air at 16:00, with re-entry until the end of level eight.', video: undefined, note: undefined } };

export const WithoutAction: Story = { args: { action: undefined } };

export const LongText: Story = {
  args: {
    heading: 'The Sunday tournament: cards in the air at 16:00',
    text: 'Every Sunday at the club: re-entry until the end of level eight, a guaranteed prize pool, a break for dinner after level six, and a seat at the final table for the last nine players.',
  },
};
