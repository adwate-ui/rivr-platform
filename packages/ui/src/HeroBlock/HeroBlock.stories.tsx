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

export const WithoutVideo: Story = { args: { eyebrow: undefined, heading: 'RIVR Academy', text: 'Learn the game in a small batch with a RIVR coach.', video: undefined, note: undefined } };

export const WithoutAction: Story = { args: { action: undefined } };

export const LongText: Story = {
  args: {
    heading: 'RIVR Academy: learn the game in a small batch',
    text: 'Three evenings with a RIVR coach: hand rankings and the rules first, then position, starting hands and how to read a table, with hands dealt at a real table between the lessons.',
  },
};
