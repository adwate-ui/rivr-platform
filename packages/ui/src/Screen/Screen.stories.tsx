import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { Money } from '../Money/Money.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Tabs } from '../Tabs/Tabs.tsx';
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

/** The console's empty state (console v3): one sentence and the one thing to do. */
export const EmptyWithAction: Story = {
  args: { title: 'Tables', status: 'empty', emptyText: 'No tables yet.', emptyAction: { label: 'Add a table', onClick: () => undefined }, actions: undefined },
};

/** The console's first load of a list (console v3): faint rows, never the word. */
export const LoadingRows: Story = { args: { title: 'Members', status: 'loading', loadingLook: 'rows', actions: undefined } };

/** The live floor's first load (console v3): faint tiles. */
export const LoadingTiles: Story = { args: { title: 'Live floor', status: 'loading', loadingLook: 'tiles', actions: undefined } };

export const WithError: Story = { args: { status: 'error', onRetry: () => undefined } };

export const LongText: Story = {
  args: {
    title: 'Withdrawals waiting for a second approver',
    status: 'error',
    errorText: 'The withdrawal queue did not load because the cage is offline. Reconnect the cage computer, then try again.',
    onRetry: () => undefined,
  },
};

const DOOR_TABS = [{ id: 'check-in', label: 'Check-in', href: '#check-in' }, { id: 'players', label: 'Today’s players', href: '#players' }];

/**
 * A console screen that holds others (console v3): its title, then its pill tabs, then the tab's own screen, whose title
 * the tab already says, heard but not shown again; its actions stay.
 */
export const WithTabs: Story = {
  tags: ['viewport-console'],
  args: {
    title: 'Door',
    actions: undefined,
    tabs: <Tabs look="pill" label="Door" current="check-in" tabs={DOOR_TABS} />,
    children: (
      <Screen title="Check-in" actions={<Button variant="subtle" size="compact">Check in by card</Button>}>
        <Text>Kabir Sethi · Member</Text>
      </Screen>
    ),
  },
};
