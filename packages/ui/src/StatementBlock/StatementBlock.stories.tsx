import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatementBlock } from './StatementBlock.tsx';

// A statement is its own content: it has no loading, empty or error state.
const meta = {
  title: 'Website/StatementBlock',
  component: StatementBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    eyebrow: 'The RIVR difference',
    lines: ['Not luck.', 'A game of skill.'],
    text: 'Cash games and tournaments dealt by casino-trained dealers, with every hand logged at the table.',
  },
} satisfies Meta<typeof StatementBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OverAStill: Story = {
  args: {
    eyebrow: 'Opens Sunday 15 November',
    lines: ['Hold your nerve.'],
    text: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram.',
    action: { label: 'Join RIVR', href: '#sign-in' },
    image: '/media/chips.webp',
    note: 'Concept visualisation',
  },
};

export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };

export const LongText: Story = {
  args: {
    lines: ['Dealers at every table.', 'A cage that pays tonight.', 'A floor on your phone.'],
    text: 'Every hand is dealt by a dealer trained to casino standard and logged at the table, and the cage counts every chip in and out, paying out the same night in cash or to your wallet.',
  },
};
