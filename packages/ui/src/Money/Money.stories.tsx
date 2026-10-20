import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from '../Stack/Stack.tsx';
import { Money } from './Money.tsx';

const meta = {
  title: 'Type/Money',
  component: Money,
  args: { paise: 12_000_000n },
} satisfies Meta<typeof Money>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PlayerMoney: Story = { args: { tone: 'player', size: 'title', paise: 48_500_000n } };

export const Jackpot: Story = { args: { size: 'jackpot', tone: 'player', paise: 34_260_000n } };

export const Sizes: Story = {
  render: () => (
    <Stack gap={2}>
      <Money paise={500_000n} size="small" />
      <Money paise={1_000_000n} />
      <Money paise={2_000_000n} size="lead" />
      <Money paise={48_500_000n} size="title" tone="player" />
      <Money paise={34_260_000n} size="display" />
    </Stack>
  ),
};

export const Empty: Story = { args: { paise: 0n, tone: 'muted' } };

export const Negative: Story = { args: { paise: -1_250_000n } };

/** A movement on Balance: a gain in gold with its plus sign, a loss with its minus sign. */
export const Signed: Story = {
  render: () => (
    <Stack gap={2}>
      <Money paise={4_650_000n} signed tone="player" />
      <Money paise={-2_000_000n} signed />
    </Stack>
  ),
};

export const LongText: Story = { args: { paise: 1_234_567_850n, size: 'title' } };
