import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from '../Banner/Banner.tsx';
import { PeekBar } from '../PeekBar/PeekBar.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Screen } from '../Screen/Screen.tsx';
import { PLAYER_TABS } from '../storybook/fixtures.ts';
import { TablesList } from '../storybook/screens.tsx';
import { PlayerDock, PlayerShell } from './PlayerShell.tsx';

const meta = {
  title: 'Shells/PlayerShell',
  component: PlayerShell,
  tags: ['viewport-phone'],
  parameters: { layout: 'fullscreen' },
  args: {
    tabs: PLAYER_TABS,
    currentTab: 'sessions',
    avatar: { initial: 'I', href: '#profile' },
    children: (
      <Screen title="Sessions" titleLook="serif">
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
  args: {
    currentTab: 'home',
    children: <><Screen title="Tonight" titleLook="serif"><TablesList /></Screen><PlayerDock><PeekBar title="All tables" aside="4 running · 2 tournaments" onOpen={() => undefined} /></PlayerDock></>,
  },
};

export const PushedScreen: Story = { args: { isTabBarHidden: true, avatar: undefined } };

/** Offline on a tab screen: the banner first, then the heading row with the initial at its end, never over the banner. */
export const WithBanner: Story = {
  args: {
    children: (
      <Stack gap={2}>
        <Banner>Offline. What you see may be out of date.</Banner>
        <Screen title="Sessions" titleLook="serif"><TablesList /></Screen>
      </Stack>
    ),
  },
};

/** Tonight's first load, edge to edge: the skeleton keeps the page's gutter, the initial at the right. */
export const FullBleedLoading: Story = {
  args: { currentTab: 'home', isFullBleed: true, children: <Screen title="Tonight" isTitleHidden status="loading" loadingLook="skeleton" /> },
};

export const LockedTab: Story = {
  args: {
    tabs: PLAYER_TABS.map((item) => (item.tab === 'sessions' ? { ...item, access: { state: 'locked', tiers: ['Black card'] } } : item)),
  },
};
