import type { Meta, StoryObj } from '@storybook/react-vite';
import { OfferCarousel } from './OfferCarousel.tsx';

const HOURS = { id: 'hours', title: 'Offer', offer: '1,000 Bonus after 4 hours', schedule: 'Every day, all tables' };
const OFFERS = [
  HOURS,
  { id: 'referral', title: 'Refer a friend', offer: '1,000 Bonus each', schedule: 'When a friend joins and takes a first seat', onOpen: () => undefined },
  { id: 'happy', title: 'Happy hour', offer: '2-for-1 at the Glaza bar', schedule: 'Daily, 19:00 to 21:00' },
  { id: 'high-hand', title: 'High hand bonus', offer: 'High hand bonus', schedule: 'Royal flush 25,000 · Straight flush 10,000 · Four of a kind 5,000' },
];

// Home shows no carousel while its offers load or when none is live; it has no state of its own.
const meta = {
  title: 'Domain/OfferCarousel',
  component: OfferCarousel,
  parameters: { layout: 'fullscreen' },
  tags: ['viewport-phone'],
  args: { title: 'Offers', offers: OFFERS },
} satisfies Meta<typeof OfferCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One offer has no dots. */
export const One: Story = { args: { offers: [HOURS] } };

export const LongText: Story = {
  args: {
    offers: [
      { id: 'long', title: 'Weeknight high hand, every table', offer: 'Bonus for the best hand of every night this week', schedule: 'Monday to Thursday, 19:00 to 02:00' },
      HOURS,
    ],
  },
};
