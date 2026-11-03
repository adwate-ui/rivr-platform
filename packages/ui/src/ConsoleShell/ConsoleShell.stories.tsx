import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvatarLink } from '../AvatarLink/AvatarLink.tsx';
import { Button } from '../Button/Button.tsx';
import { SearchTrigger } from '../CommandPalette/SearchTrigger.tsx';
import { Grid } from '../Grid/Grid.tsx';
import { HeaderPulse } from '../HeaderPulse/HeaderPulse.tsx';
import { KillSwitchBanner as Banner } from '../KillSwitchBanner/KillSwitchBanner.tsx';
import { Screen } from '../Screen/Screen.tsx';
import { consoleSections, consoleTabs } from '../storybook/fixtures.ts';
import { TableTile, type TileSeat } from '../TableTile/TableTile.tsx';
import { Time } from '../Time/Time.tsx';
import { ConsoleShell } from './ConsoleShell.tsx';

const SEATS: readonly TileSeat[][] = [
  ['seated', 'needsYou', 'open', 'seated', 'seated', 'open', 'seated', 'needsYou', 'open'],
  ['needsYou', 'seated', 'needsYou', 'open', 'seated', 'seated', 'open', 'needsYou', 'seated'],
  ['seated', 'open', 'needsYou', 'seated', 'open', 'seated', 'needsYou', 'open', 'open'],
];

function tile(name: string, stake: string, seats: readonly TileSeat[]) {
  return <TableTile key={name} name={name} stake={stake} seats={seats} isExpanded={false} onToggle={() => undefined} onSettings={() => undefined} />;
}

const floor = (
  <Screen title="Live floor" actions={<Button variant="primary" size="compact">Seat a player</Button>}>
    <Grid columns={3} gap={3} stackBelow="medium">
      {tile('Table 1', '50/100', SEATS[0] ?? [])}
      {tile('Table 2', '100/200', SEATS[1] ?? [])}
      {tile('Table 3', '100/200', SEATS[2] ?? [])}
    </Grid>
  </Screen>
);

const PULSE = [
  { id: 'seated', count: 23, label: 'seated', href: '#floor' },
  { id: 'waiting', count: 6, label: 'waiting', href: '#waitlist' },
  { id: 'requests', count: 12, label: 'requests', href: '#requests', needsYou: true },
];

const meta = {
  title: 'Shells/ConsoleShell',
  component: ConsoleShell,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    sections: consoleSections(),
    tabs: consoleTabs(),
    currentItem: 'floor',
    search: <SearchTrigger onOpen={() => undefined} />,
    pulse: <HeaderPulse label="Tonight" items={PULSE} />,
    clock: <Time at={new Date('2026-11-15T06:10:00Z')} tone="muted" />,
    account: <AvatarLink initial="V" href="#account" />,
    children: floor,
  },
} satisfies Meta<typeof ConsoleShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** At a desk, 1440 px: the rail with its labels, the header's search, pulse and clock. */
export const Default: Story = {};

/** The floor's 1180 px tablet: the rail folds to its icons on its own, each count a dot. */
export const OnATablet: Story = { tags: ['!viewport-console', 'viewport-tablet'] };

/** On a phone: the header names the screen, and the tab bar holds the app's tabs and More. */
export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };

export const Loading: Story = { args: { children: <Screen title="Live floor" status="loading" loadingLook="tiles" /> } };

export const Empty: Story = {
  args: {
    currentItem: 'tables',
    children: <Screen title="Tables" status="empty" emptyText="No tables yet." emptyAction={{ label: 'Add a table', onClick: () => undefined }} />,
  },
};

export const WithError: Story = { args: { currentItem: 'members', children: <Screen title="Members" status="error" onRetry={() => undefined} /> } };

/** The kill switch's banner across the top, above everything; an Admin screen open, its group with it. */
export const KillSwitchBanner: Story = {
  args: { banner: <Banner audience="staff" />, currentItem: 'kill', children: <Screen title="Kill switch" status="empty" emptyText="The venue is frozen." /> },
};

export const OnAPhoneLongTitle: Story = {
  tags: ['!viewport-console', 'viewport-phone'],
  args: {
    sections: [{ id: 'tonight', label: 'Tonight', items: [{ id: 'long', label: 'Tournament registrations and late entries', href: '#long', icon: 'waitlist' }] }],
    currentItem: 'long',
    children: <Screen title="Tournament registrations and late entries" status="empty" emptyText="No registrations yet." />,
  },
};
