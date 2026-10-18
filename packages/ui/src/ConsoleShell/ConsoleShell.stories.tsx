import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { Screen } from '../Screen/Screen.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Switch } from '../Switch/Switch.tsx';
import { Text } from '../Text/Text.tsx';
import { consoleSections } from '../storybook/fixtures.ts';
import { KillSwitchBanner as Banner } from '../KillSwitchBanner/KillSwitchBanner.tsx';
import { TablesList } from '../storybook/screens.tsx';
import { ConsoleShell } from './ConsoleShell.tsx';

const meta = {
  title: 'Shells/ConsoleShell',
  component: ConsoleShell,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    sections: consoleSections(),
    currentItem: 'liveFloor',
    children: (
      <Screen title="Live floor">
        <TablesList />
      </Screen>
    ),
  },
} satisfies Meta<typeof ConsoleShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { children: <Screen title="Live floor" status="loading" /> } };

export const Empty: Story = {
  args: { currentItem: 'markers', children: <Screen title="Markers" status="empty" emptyText="No open markers." /> },
};

export const WithError: Story = {
  args: { currentItem: 'cage', children: <Screen title="Cage" status="error" onRetry={() => undefined} /> },
};

export const KillSwitchBanner: Story = { args: { banner: <Banner audience="staff" /> } };

/** The foot of the rail as the console fills it: the staff member, the practice switch, sign out. */
export const WithStaff: Story = {
  args: {
    railFooter: (
      <Stack gap={3}>
        <Stack gap={1}>
          <Text weight="medium">Sana Qureshi</Text>
          <Text variant="small" tone="muted">RIVR Gurugram</Text>
        </Stack>
        <Switch label="Practice venue" isOn={false} onChange={() => undefined} />
        <Button variant="secondary">Sign out</Button>
      </Stack>
    ),
  },
};
