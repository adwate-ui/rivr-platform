import type { Meta, StoryObj } from '@storybook/react-vite';
import { DisplayShell } from '../DisplayShell/DisplayShell.tsx';
import { TV_STORY_NOTICE, TV_STORY_NOW } from '../test/tvStory.tsx';
import { Text } from '../Text/Text.tsx';
import { TvStage, type TvStageProps } from './TvStage.tsx';

/** The stage on the TV, with the clock and whatever notice runs. */
const onTv = (notice: string | undefined) => (args: TvStageProps) => (
  <DisplayShell clockAt={TV_STORY_NOW} notice={notice}>
    <TvStage {...args} />
  </DisplayShell>
);

const meta = {
  title: 'TV/TvStage',
  component: TvStage,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  render: onTv(TV_STORY_NOTICE),
  args: {
    title: 'Waitlist',
    children: <Text variant="tvBody" tone="muted">No one waiting.</Text>,
  },
} satisfies Meta<typeof TvStage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No notice running and no title: the wordmark and the clock, and no rule or line at the foot. */
export const Empty: Story = { render: onTv(undefined), args: { title: undefined } };

/** A notice at its longest, 280 characters: two lines, then cut. */
export const LongText: Story = {
  render: onTv('The Private Room opens at 9 tonight for Pot-Limit Omaha 1,000/2,000 with a three-hour call time. Ask the floor manager for a seat before 8. '
    + 'Table 4 moves to No-Limit Hold’em 100/200/500 at midnight, and the kitchen takes its last order at half past two. Thank you for playing at RIVR.'),
  args: { title: 'High hand bonus and promotions' },
};
