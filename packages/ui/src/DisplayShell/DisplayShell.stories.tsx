import type { Meta, StoryObj } from '@storybook/react-vite';
import { TV_STORY_NOTICE, TV_STORY_NOW } from '../test/tvStory.tsx';
import { Text } from '../Text/Text.tsx';
import { TvStage } from '../TvStage/TvStage.tsx';
import { DisplayShell } from './DisplayShell.tsx';

const meta = {
  title: 'Shells/DisplayShell',
  component: DisplayShell,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  args: {
    clockAt: TV_STORY_NOW,
    notice: TV_STORY_NOTICE,
    children: <TvStage title="Waitlist"><Text variant="tvBody" tone="muted">No one waiting.</Text></TvStage>,
  },
} satisfies Meta<typeof DisplayShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A TV not yet paired: no board, no clock and no notice. */
export const Empty: Story = {
  args: {
    clockAt: undefined,
    notice: undefined,
    children: <TvStage><Text variant="tvBody" tone="muted">This TV is not set up yet.</Text></TvStage>,
  },
};

export const LongText: Story = {
  args: {
    notice: 'The Private Room opens at 9 tonight for Pot-Limit Omaha 1,000/2,000 with a three-hour call time. Ask the floor manager for a seat before 8.',
    children: <TvStage title="High hand bonus and promotions"><Text variant="tvBody">Straight flush, nine high · Private Room · 01:12</Text></TvStage>,
  },
};
