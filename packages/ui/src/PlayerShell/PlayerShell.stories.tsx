import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvatarLink } from '../AvatarLink/AvatarLink.tsx';
import { PeekBar } from '../PeekBar/PeekBar.tsx';
import { Screen } from '../Screen/Screen.tsx';
import { PLAYER_TABS } from '../storybook/fixtures.ts';
import { TablesList } from '../storybook/screens.tsx';
import { PlayerShell } from './PlayerShell.tsx';

const meta = {
  title: 'Shells/PlayerShell',
  component: PlayerShell,
  tags: ['viewport-phone'],
  parameters: { layout: 'fullscreen' },
  args: {
    tabs: PLAYER_TABS,
    currentTab: 'sessions',
    children: (
      <Screen title="Sessions" titleLook="serif" actions={<AvatarLink initial="I" href="#profile" />}>
        <TablesList />
      </Screen>
    ),
  },
} satisfies Meta<typeof PlayerShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { children: <Screen title="Sessions" titleLook="serif" status="loading" loadingLook="skeleton" /> } };

export const Empty: Story = {
  args: { children: <Screen title="Sessions" titleLook="serif" status="empty" emptyText="No sessions yet." /> },
};

export const WithError: Story = {
  args: { currentTab: 'rewards', children: <Screen title="Rewards" titleLook="serif" status="error" onRetry={() => undefined} /> },
};

export const WithDock: Story = {
  args: { currentTab: 'home', dock: <PeekBar title="All tables" aside="4 running · 2 tournaments" onOpen={() => undefined} /> },
};

export const PushedScreen: Story = { args: { isTabBarHidden: true } };

export const LockedTab: Story = {
  args: {
    tabs: PLAYER_TABS.map((item) => (item.tab === 'sessions' ? { ...item, access: { state: 'locked', tiers: ['Black card'] } } : item)),
  },
};
