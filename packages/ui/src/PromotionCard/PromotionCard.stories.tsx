import type { Meta, StoryObj } from '@storybook/react-vite';
import { PromotionCard } from './PromotionCard.tsx';

const meta = {
  title: 'Player/PromotionCard',
  tags: ['viewport-phone'],
  component: PromotionCard,
  args: { title: 'Double points', runs: 'NLH 100/200 · Thursday, 14:00 to 20:00' },
} satisfies Meta<typeof PromotionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A promotion whose title does not say what it gives. */
export const WithDetail: Story = {
  args: { title: 'High hands', detail: 'Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000', runs: 'Every night' },
};

/** The least a card has: its title. */
export const Empty: Story = { args: { runs: undefined } };

export const LongText: Story = {
  args: {
    title: 'Buy-in bonus Tuesday at every table in the club',
    detail: '20% on the first five buy-ins at each table, up to ₹2,000 a buy-in, played as bonus within a week',
    runs: 'Every stake · Tuesday, 18:00 to 04:00',
  },
};
