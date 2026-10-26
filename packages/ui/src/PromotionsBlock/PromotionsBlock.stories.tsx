import type { Meta, StoryObj } from '@storybook/react-vite';
import { PromotionsBlock } from './PromotionsBlock.tsx';

const meta = {
  title: 'Website/PromotionsBlock',
  component: PromotionsBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    heading: 'On the house',
    emptyText: 'No promotions are running just now.',
    promotions: [
      { title: 'Buy-in bonus Tuesday', detail: '20% on the first five buy-ins per table', runs: 'Tuesday · all stakes' },
      { title: 'High hands', detail: 'Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000', runs: 'Every night' },
      { title: 'Referral', detail: '₹1,000 to each side', runs: 'Every day' },
    ],
  },
} satisfies Meta<typeof PromotionsBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { promotions: [] } };

export const LongText: Story = {
  args: { promotions: [{ title: 'A promotion with a long title', detail: 'An unusually long line, as an owner might write it in the console, to see that it wraps cleanly and never breaks the band', runs: 'Tuesday, 22:00 to 04:00 · every stake' }] },
};
