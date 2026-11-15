import type { Meta, StoryObj } from '@storybook/react-vite';
import { onTv } from '../test/tvStory.tsx';
import { TvPromotionSlide } from './TvPromotionSlide.tsx';

const meta = {
  title: 'TV/TvPromotionSlide',
  component: TvPromotionSlide,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  decorators: [onTv],
  args: {
    board: 'Promotions',
    label: 'Offer',
    title: 'Friday four-hour bonus',
    detail: '1,000 Bonus after 4 hours',
    when: 'Every day, all tables',
    pager: { current: 1, count: 4, label: 'Promotion 1 of 4' },
  },
} satisfies Meta<typeof TvPromotionSlide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The only promotion live: no pager. */
export const Alone: Story = { args: { title: 'Thursday bonus', detail: undefined, when: 'Thursday, 14:00 to 20:00 · 100/200', pager: undefined } };

/** The least a promotion has: its title. */
export const Empty: Story = { args: { detail: undefined, when: undefined, pager: undefined } };

export const LongText: Story = {
  args: {
    title: 'Buy-in bonus Tuesday at every table',
    detail: '20% on the first five buy-ins at each table, up to 2,000 a buy-in, played as Bonus within a week',
    when: 'Tuesday, 18:00 to 04:00 · Every stake',
    pager: { current: 3, count: 6, label: 'Promotion 3 of 6' },
  },
};
