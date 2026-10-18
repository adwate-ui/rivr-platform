import type { Meta, StoryObj } from '@storybook/react-vite';
import { Screen } from '../Screen/Screen.tsx';
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

export const Hindi: Story = {
  globals: { locale: 'hi' },
  args: {
    sections: consoleSections('hi'),
    banner: <Banner audience="staff" />,
    children: (
      <Screen title="लाइव फ़्लोर">
        <TablesList locale="hi" />
      </Screen>
    ),
  },
};
