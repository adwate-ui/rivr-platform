import type { Meta, StoryObj } from '@storybook/react-vite';
import { Screen } from '../Screen/Screen.tsx';
import { PLAYER_TABS } from '../storybook/fixtures.ts';
import { KillSwitchBanner as Banner } from '../KillSwitchBanner/KillSwitchBanner.tsx';
import { TablesList } from '../storybook/screens.tsx';
import { PlayerShell } from './PlayerShell.tsx';

const meta = {
  title: 'Shells/PlayerShell',
  component: PlayerShell,
  tags: ['viewport-phone'],
  parameters: { layout: 'fullscreen' },
  args: {
    tabs: PLAYER_TABS,
    currentTab: 'home',
    memberInitial: 'A',
    profileHref: '#profile',
    children: (
      <Screen title="Tonight">
        <TablesList />
      </Screen>
    ),
  },
} satisfies Meta<typeof PlayerShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { children: <Screen title="Tonight" status="loading" /> } };

export const Empty: Story = {
  args: { currentTab: 'sessions', children: <Screen title="Sessions" status="empty" emptyText="No sessions yet." /> },
};

export const WithError: Story = {
  args: { currentTab: 'balance', children: <Screen title="Balance" status="error" onRetry={() => undefined} /> },
};

export const KillSwitchBanner: Story = { args: { banner: <Banner audience="member" /> } };

export const BeforeSignIn: Story = { args: { memberInitial: undefined } };

export const LockedTab: Story = {
  args: {
    tabs: PLAYER_TABS.map((item) => (item.tab === 'learn' ? { ...item, access: { state: 'locked', tiers: ['Black card'] } } : item)),
  },
};

export const Hindi: Story = {
  globals: { locale: 'hi' },
  args: {
    memberInitial: 'आ',
    banner: <Banner audience="member" />,
    children: (
      <Screen title="आज रात">
        <TablesList locale="hi" />
      </Screen>
    ),
  },
};
