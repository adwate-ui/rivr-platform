import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeroBlock } from './HeroBlock.tsx';

const meta = {
  title: 'Website/HeroBlock',
  component: HeroBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    heading: 'RIVR Poker Club',
    text: 'Opens Sunday 15 November, upper floor, Glaza, M3M 65th Avenue, Gurugram.',
    action: { label: 'Join RIVR', href: '#sign-in' },
  },
} satisfies Meta<typeof HeroBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutAction: Story = { args: { action: undefined } };

export const LongText: Story = {
  args: {
    heading: 'RIVR Academy: learn the game in a small batch',
    text: 'Three evenings with a RIVR coach: hand rankings and the rules first, then position, starting hands and how to read a table, with hands dealt at a real table between the lessons.',
  },
};
