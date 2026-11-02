import type { Meta, StoryObj } from '@storybook/react-vite';
import { OfferCarousel } from './OfferCarousel.tsx';

const OFFERS = [
  { id: 'referral', title: 'Referral', offer: '1,000 bonus chips each', schedule: 'Every day', onOpen: () => undefined },
  { id: 'happy', title: 'Happy hour', offer: '2-for-1 at the Glaza bar', schedule: 'Daily, 19:00 to 21:00' },
  { id: 'high-hand', title: 'High hand', offer: 'Bonus chips for the night’s best hand', schedule: 'Every night' },
];

// Tonight shows no carousel while its offers load or when none is live; it has no state of its own.
const meta = {
  title: 'Domain/OfferCarousel',
  component: OfferCarousel,
  parameters: { layout: 'fullscreen' },
  tags: ['viewport-phone'],
  args: { title: 'Tonight', countLabel: '3 offers', offers: OFFERS },
} satisfies Meta<typeof OfferCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const One: Story = { args: { countLabel: '1 offer', offers: OFFERS.slice(0, 1) } };

export const LongText: Story = {
  args: { offers: [{ id: 'long', title: 'Weeknight high hand, every table', offer: 'Bonus chips for the best hand of every night this week', schedule: 'Monday to Thursday, 19:00 to 02:00' }] },
};
