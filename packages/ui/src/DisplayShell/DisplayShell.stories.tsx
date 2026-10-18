import type { Meta, StoryObj } from '@storybook/react-vite';
import { Money } from '../Money/Money.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { Time } from '../Time/Time.tsx';
import { DisplayShell } from './DisplayShell.tsx';

// 00:10 IST.
const NOW = new Date('2026-11-15T18:40:00Z');

const jackpot = (label: string, highHand: string) => (
  <Stack grow justify="center" gap={6}>
    <Text variant="tvLabel" tone="muted">
      {label}
    </Text>
    <Money paise={34_260_000n} size="jackpot" tone="player" />
    <Text variant="tvBody">{highHand}</Text>
  </Stack>
);

const meta = {
  title: 'Shells/DisplayShell',
  component: DisplayShell,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  args: {
    corner: <Time at={NOW} size="title" />,
    children: jackpot('Bad-beat jackpot', 'High hand tonight · Four nines · Table 3'),
  },
} satisfies Meta<typeof DisplayShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    children: (
      <Text variant="tvBody" tone="muted">
        No promotions running.
      </Text>
    ),
  },
};

export const LongText: Story = {
  args: { children: jackpot('Bad-beat jackpot, main pool plus the season pool', 'High hand tonight · Straight flush, nine high · Private Room · 01:12') },
};
