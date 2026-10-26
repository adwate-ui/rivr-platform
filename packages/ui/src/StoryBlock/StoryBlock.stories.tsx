import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryBlock } from './StoryBlock.tsx';

const meta = {
  title: 'Website/StoryBlock',
  component: StoryBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    eyebrow: 'Our story',
    heading: 'Good hands. Better company.',
    paragraphs: [
      'RIVR opens on Sunday 15 November with one idea: Gurugram’s serious players deserve a room built for them.',
      'Not a casino. A members’ club where every player is verified and every dealer is a professional.',
    ],
    figures: [{ value: '6', label: 'Tables' }, { value: '2', label: 'Rooms' }, { value: '18+', label: 'Verified members only' }, { value: '₹50', label: 'The smallest chip' }],
    action: { label: 'Join RIVR', href: '#' },
    image: '/media/room.webp',
    alt: 'The main room at RIVR',
  },
} satisfies Meta<typeof StoryBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Words alone, with no photo or figures. */
export const WordsOnly: Story = { args: { image: undefined, alt: undefined, figures: undefined, action: undefined } };
