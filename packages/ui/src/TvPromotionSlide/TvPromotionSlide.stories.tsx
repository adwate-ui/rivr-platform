import type { Meta, StoryObj } from '@storybook/react-vite';
import { DisplayShell } from '../DisplayShell/DisplayShell.tsx';
import { TvPromotionSlide } from './TvPromotionSlide.tsx';

const meta = {
  title: 'TV/TvPromotionSlide',
  component: TvPromotionSlide,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <DisplayShell><Story /></DisplayShell>],
  args: {
    label: 'Promotion',
    title: 'High hands',
    detail: 'Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000',
    when: 'Every night',
    pager: { current: 2, count: 3, label: 'Promotion 2 of 3' },
  },
} satisfies Meta<typeof TvPromotionSlide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The only promotion live: no pager. */
export const Alone: Story = { args: { title: 'Double points', detail: undefined, when: 'Thursday, 14:00 to 20:00 · 100/200', pager: undefined } };

/** The least a promotion has: its title. */
export const Empty: Story = { args: { detail: undefined, when: undefined, pager: undefined } };

export const LongText: Story = {
  args: {
    title: 'Buy-in bonus Tuesday at every table',
    detail: '20% on the first five buy-ins at each table, up to ₹2,000 a buy-in, played as bonus within a week',
    when: 'Tuesday, 18:00 to 04:00 · Every stake',
    pager: { current: 1, count: 6, label: 'Promotion 1 of 6' },
  },
};
