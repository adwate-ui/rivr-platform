import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarqueeBlock } from './MarqueeBlock.tsx';

const meta = {
  title: 'Website/MarqueeBlock',
  component: MarqueeBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: { phrases: ['Play', 'Connect', 'Belong', 'Members only', 'Six tables', 'Hold your nerve', 'Gurugram'] },
} satisfies Meta<typeof MarqueeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = {
  args: { phrases: ['A phrase that runs as long as forty', 'Another long phrase, nearly forty', 'Members only', 'Opens 15 November', 'Hold your nerve', 'Gurugram'] },
};
