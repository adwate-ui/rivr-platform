import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataTableExportProvider } from '../DataTable/DataTableExport.tsx';
import { ConsoleFrameContext } from '../internal/consoleFrame.ts';
import { SettingsGroups } from './SettingsGroups.tsx';

const change = () => undefined;

const GROUPS = [
  {
    heading: 'Seating',
    settings: [
      { key: 'seat_hold', name: 'Seat hold', line: 'How long a called seat is held', now: '20 minutes', who: 'Admins', toCome: 'From Mon 16 Nov, 18:00: 25 minutes', onChange: change },
      { key: 'open_at', name: 'Open a game at', line: 'Players waiting before the floor is told', now: '6 players waiting', who: 'Admins', toCome: '–', onChange: change },
    ],
  },
  {
    heading: 'Time at the table',
    settings: [
      { key: 'call_time', name: 'Call time', line: 'Least time at the table, per stake', now: ['NLH 50/100 3 h', 'NLH 100/200 3 h'], who: 'Admins', toCome: ['From Mon 16 Nov, 18:00:', 'NLH 50/100 4 h'], onChange: change },
      { key: 'add_time', name: 'Add time choices', line: 'Lengths a seated member can ask for', now: '30 min, 1 h and 2 h', who: 'Admins', toCome: '–', onChange: change },
    ],
  },
  {
    heading: 'Identity',
    settings: [{ key: 'kyc', name: 'Identity (KYC) checked at the club', line: 'Staff check Aadhaar and PAN at the desk', now: 'On', who: 'Super admin', toCome: '–', onHistory: change }],
  },
];

// The groups draw settings the screen has already loaded: the Settings screen carries loading and a failed load.
const meta = {
  title: 'Data/SettingsGroups',
  component: SettingsGroups,
  args: { label: 'Settings', searchLabel: 'Find a setting', groups: GROUPS },
  // The console's own looks, as inside its shell, where staff may export.
  decorators: [(Story) => <ConsoleFrameContext value><DataTableExportProvider exporter={async () => true}><Story /></DataTableExportProvider></ConsoleFrameContext>],
} satisfies Meta<typeof SettingsGroups>;

export default meta;
type Story = StoryObj<typeof meta>;

/** At a desk: one search and one Export over every group; a setting the staff member only reads has History. */
export const Default: Story = { tags: ['viewport-console'] };

/** A tab with no settings to show: the search, and one line. */
export const Empty: Story = { args: { groups: [] }, tags: ['viewport-console'] };

/** Many stakes, each on its own line, a long value and two changes to come. */
export const LongText: Story = {
  args: {
    groups: [{
      heading: 'Time at the table',
      settings: [
        { key: 'call_time', name: 'Call time', line: 'Least time at the table, per stake', who: 'Admins', onChange: change,
          now: ['NLH 50/100 3 h', 'NLH 100/200/500 3 h', 'PLO 100/200 4 h', 'NLH 200/400 5 h', 'Private Room 6 h 30 min'],
          toCome: ['From Mon 16 Nov, 18:00:', 'NLH 50/100 4 h', 'PLO 100/200 5 h', 'From Tue 1 Dec, 06:00:', 'Private Room 8 h'] },
        { key: 'targets', name: 'Request targets', line: 'When a waiting request shows late', who: 'Admins', toCome: '–', onChange: change,
          now: 'Top-up, seconds: 180 seconds · Others, seconds: 300 seconds (default)' },
      ],
    }],
  },
  tags: ['viewport-console'],
};

/** On a tablet held upright (768 px). */
export const OnAPortraitTablet: Story = { tags: ['viewport-portrait'] };

/** On a phone the search takes the first line, and each setting is a card. */
export const OnAPhone: Story = { tags: ['viewport-phone'] };
