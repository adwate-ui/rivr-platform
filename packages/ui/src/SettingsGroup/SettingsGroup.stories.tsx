import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleFrameContext } from '../internal/consoleFrame.ts';
import { SettingsGroup, type SettingsRow } from './SettingsGroup.tsx';

const change = () => undefined;

const SEATING: readonly SettingsRow[] = [
  { key: 'seat_hold', name: 'Seat hold', line: 'How long a called seat waits', now: '20 minutes', who: 'Admins', toCome: '–', onChange: change },
  { key: 'open_at', name: 'Open a game at', line: 'Players waiting before the floor is told', now: '6 players', who: 'Admins', toCome: '8 players from 16 Nov 2026', onChange: change },
  { key: 'priority', name: 'Waitlist priority', line: 'Who is seated first', now: 'Black card first, at the stake they play', who: 'Admins', toCome: '–', onChange: change },
];

// A group draws settings the screen has already loaded: the Settings screen carries loading and a failed load.
const meta = {
  title: 'Data/SettingsGroup',
  component: SettingsGroup,
  args: { heading: 'Seating', settings: SEATING },
  // The console's own looks, as inside its shell.
  decorators: [(Story) => <ConsoleFrameContext value><Story /></ConsoleFrameContext>],
} satisfies Meta<typeof SettingsGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** At a desk: the group's heading, its column names, and a row for each setting with Change at its end. */
export const Default: Story = { tags: ['viewport-console'] };

/** For a staff member who may change none of them: no Change. */
export const ReadOnly: Story = { args: { settings: SEATING.map(({ onChange: _onChange, ...setting }) => setting) }, tags: ['viewport-console'] };

/** Call time shows every stake's value on its line, and a change to come. */
export const LongText: Story = {
  args: {
    heading: 'Time at the table',
    settings: [
      { key: 'call_time', name: 'Call time', line: 'Least time at the table, per stake', now: 'NLH 50/100 3 h · NLH 100/200/500 3 h · PLO 100/200 4 h · NLH 200/400 5 h', who: 'Admins',
        toCome: 'NLH 50/100 4 h from 16 Nov 2026, 18:00', onChange: change },
      { key: 'add_time', name: 'Add time choices', line: 'Lengths a seated member can ask for', now: '30 min, 1 h, 2 h', who: 'Super admin', toCome: '–', onChange: change },
    ],
  },
  tags: ['viewport-console'],
};

/** A group the search leaves nothing of. */
export const Empty: Story = { args: { settings: [] } };

/** On a tablet held upright (768 px). */
export const OnAPortraitTablet: Story = { tags: ['viewport-portrait'] };

/** On a phone each setting is a card: its name and line, then each column named beside its value, then Change. */
export const OnAPhone: Story = { tags: ['viewport-phone'] };
