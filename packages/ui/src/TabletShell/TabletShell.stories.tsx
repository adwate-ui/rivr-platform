import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { Screen } from '../Screen/Screen.tsx';
import { OfflineBanner, TablesList } from '../storybook/screens.tsx';
import { TabletShell } from './TabletShell.tsx';

const meta = {
  title: 'Shells/TabletShell',
  component: TabletShell,
  tags: ['viewport-tablet'],
  parameters: { layout: 'fullscreen' },
  args: {
    tableName: 'Table 3',
    actions: <Button>End of down</Button>,
    children: (
      <Screen title="Hand entry">
        <TablesList />
      </Screen>
    ),
  },
} satisfies Meta<typeof TabletShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Offline: Story = { args: { banner: <OfflineBanner /> } };

export const Loading: Story = { args: { children: <Screen title="Hand entry" status="loading" /> } };

export const WithError: Story = { args: { children: <Screen title="Hand entry" status="error" onRetry={() => undefined} /> } };

export const LongText: Story = { args: { tableName: 'Private Room · Pot-limit Omaha 1,000/2,000 · Bomb pot every orbit' } };

export const Hindi: Story = {
  globals: { locale: 'hi' },
  args: {
    tableName: 'टेबल 3',
    banner: <OfflineBanner locale="hi" />,
    actions: <Button>डाउन खत्म</Button>,
    children: (
      <Screen title="हाथ दर्ज करें">
        <TablesList locale="hi" />
      </Screen>
    ),
  },
};
