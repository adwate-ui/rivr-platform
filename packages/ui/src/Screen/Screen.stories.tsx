import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { Money } from '../Money/Money.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { Screen } from './Screen.tsx';

const balance = (
  <Stack gap={3} divided>
    <Inline justify="between">
      <Text>Cash</Text>
      <Money paise={12_000_000n} tone="player" size="lead" />
    </Inline>
    <Inline justify="between">
      <Text>Bonus · expires Sunday</Text>
      <Money paise={400_000n} tone="player" size="lead" />
    </Inline>
  </Stack>
);

const meta = {
  title: 'Layout/Screen',
  component: Screen,
  args: { title: 'Balance', children: balance, actions: <Button variant="primary">Withdraw</Button> },
} satisfies Meta<typeof Screen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { status: 'loading' } };

export const Empty: Story = { args: { title: 'Sessions', status: 'empty', emptyText: 'No sessions yet.', actions: undefined } };

export const WithError: Story = { args: { status: 'error', onRetry: () => undefined } };

export const LongText: Story = {
  args: {
    title: 'Withdrawals waiting for a second approver',
    status: 'error',
    errorText: 'The withdrawal queue did not load because the cage is offline. Reconnect the cage computer, then try again.',
    onRetry: () => undefined,
  },
};

export const Hindi: Story = {
  globals: { locale: 'hi' },
  args: {
    title: 'बैलेंस',
    actions: <Button variant="primary">निकासी</Button>,
    children: (
      <Inline justify="between">
        <Text>नकद</Text>
        <Money paise={12_000_000n} tone="player" size="lead" />
      </Inline>
    ),
  },
};
