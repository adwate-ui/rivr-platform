import type { Meta, StoryObj } from '@storybook/react-vite';
import { FeatureBlock } from './FeatureBlock.tsx';

// A feature is its own content: it has no loading, empty or error state.
const meta = {
  title: 'Website/FeatureBlock',
  component: FeatureBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    eyebrow: 'The RIVR app',
    heading: 'Done waiting for a seat?',
    text: 'See tonight\'s tables, join the waitlist before you leave home, and get called to your seat.',
    points: ['Live tables', 'The waitlist', 'Your seat, held'],
    action: { label: 'Join RIVR', href: '#sign-in' },
    image: '/media/app-home.webp',
    alt: 'The RIVR app\'s Home: tonight\'s tables with their open seats and the bad-beat jackpot',
  },
} satisfies Meta<typeof FeatureBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };

export const WithoutPoints: Story = { args: { points: undefined, action: undefined } };

export const LongText: Story = {
  args: {
    heading: 'Reserve your seat from your phone, wherever you are tonight',
    text: 'See every table running tonight with its stakes and open seats, join the waitlist before you leave home, follow your place, and get called to your seat with a hold that waits for you at the door.',
  },
};
