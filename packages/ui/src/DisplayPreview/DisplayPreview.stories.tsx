import type { Meta, StoryObj } from '@storybook/react-vite';
import { TvPromotionSlide } from '../TvPromotionSlide/TvPromotionSlide.tsx';
import { DisplayPreview } from './DisplayPreview.tsx';

const meta = {
  title: 'TV/DisplayPreview',
  component: DisplayPreview,
  tags: ['viewport-console'],
  args: {
    label: 'TV slide',
    children: <TvPromotionSlide label="Promotion" title="Thursday bonus" when="NLH 100/200 · Thursday, 14:00 to 20:00" />,
  },
} satisfies Meta<typeof DisplayPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Nothing on the stage yet: the wordmark alone, as a TV between slides. */
export const Empty: Story = { args: { children: null } };

export const LongText: Story = {
  args: {
    children: <TvPromotionSlide label="Promotion" title="Buy-in bonus Tuesday at every table" detail="20% on the first five buy-ins at each table, up to ₹2,000 a buy-in"
      when="Tuesday, 18:00 to 04:00 · Every stake" />,
  },
};
