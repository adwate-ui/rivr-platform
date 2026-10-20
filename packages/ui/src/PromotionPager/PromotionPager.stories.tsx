import type { Meta, StoryObj } from '@storybook/react-vite';
import { PromotionPager } from './PromotionPager.tsx';

const meta = {
  title: 'Player/PromotionPager',
  component: PromotionPager,
  tags: ['viewport-phone'],
  args: {
    label: 'Promotions',
    cards: [
      { id: 'tue', title: 'Buy-in bonus Tuesday', detail: '20% on the first five buy-ins per table', runs: 'Tuesday · all stakes' },
      { id: 'hh', title: 'High hands', detail: 'Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000', runs: 'Every night' },
      { id: 'ref', title: 'Referral', detail: '₹1,000 to each side', runs: 'Every day' },
    ],
    pageLabels: ['Promotion 1 of 3', 'Promotion 2 of 3', 'Promotion 3 of 3'],
  },
} satisfies Meta<typeof PromotionPager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One promotion live: its card, and no dots. */
export const Alone: Story = { args: { cards: [{ id: 'dp', title: 'Double points', runs: 'NLH 100/200 · Thursday, 14:00 to 20:00' }], pageLabels: ['Promotion 1 of 1'] } };

/** Nothing live: nothing shows. */
export const Empty: Story = { args: { cards: [], pageLabels: [] } };

export const LongText: Story = {
  args: {
    cards: [
      { id: 'long', title: 'Buy-in bonus Tuesday at every table in the club', detail: '20% on the first five buy-ins at each table, up to ₹2,000 a buy-in, played as bonus within a week',
        runs: 'Every stake · Tuesday, 18:00 to 04:00 · First 50 members a day' },
      { id: 'two', title: 'Referral', detail: '₹1,000 to each side', runs: 'Every day' },
    ],
    pageLabels: ['Promotion 1 of 2', 'Promotion 2 of 2'],
  },
};
