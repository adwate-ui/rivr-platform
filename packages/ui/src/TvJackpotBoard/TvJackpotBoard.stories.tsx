import type { Meta, StoryObj } from '@storybook/react-vite';
import { DisplayShell } from '../DisplayShell/DisplayShell.tsx';
import { TvJackpotBoard } from './TvJackpotBoard.tsx';

const meta = {
  title: 'TV/TvJackpotBoard',
  component: TvJackpotBoard,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <DisplayShell><Story /></DisplayShell>],
  args: {
    label: 'Bad-beat jackpot',
    amount: 34_260_000n,
    highHandLabel: 'High hand tonight',
    highHand: { title: 'Four of a kind, Queens', line: 'Table 2 · 22:18 · ₹2,000' },
    noHighHandText: 'No high hand yet tonight.',
  },
} satisfies Meta<typeof TvJackpotBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Before a high hand is paid tonight. */
export const Empty: Story = { args: { highHand: null } };

export const LongText: Story = {
  args: {
    amount: 1_23_45_67_800n,
    highHand: { title: 'Straight flush', line: 'Private Room · 01:12 · ₹10,000' },
  },
};
