import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChoiceChips } from '../ChoiceChips/ChoiceChips.tsx';
import { TierMatrix, type TierMatrixRow } from './TierMatrix.tsx';

const TIERS = [
  { id: 'member', name: 'Member' },
  { id: 'graduate', name: 'Academy graduate' },
  { id: 'founders', name: "Founders' Circle" },
  { id: 'black', name: 'Black card' },
];
const CHOICES = [{ value: 'on', label: 'On' }, { value: 'locked', label: 'Locked' }, { value: 'hidden', label: 'Hidden' }];

/** A row whose cells are the console's choice, the given one pressed in every tier but Member. */
function row(key: string, name: string, description: string, member: string): TierMatrixRow {
  const cells = Object.fromEntries(TIERS.map((tier) => [tier.id, (
    <ChoiceChips label={`${name} for ${tier.name}`} isLabelVisuallyHidden mode="one" options={CHOICES}
      selected={[tier.id === 'member' ? member : 'on']} onChange={() => undefined} />
  )]));
  return { key, name, description, cells };
}

const ROWS = [
  row('learn.library', 'Learn library', 'The Learn tab and its library of sources.', 'locked'),
  row('league.standings', 'League', 'RIVR League standings and season.', 'hidden'),
  row('sessions.history', 'Session history', 'Past sessions with buy-in, cash-out, net and receipts.', 'on'),
];

const meta = {
  title: 'Data/TierMatrix',
  component: TierMatrix,
  args: { label: 'Features by tier', featureHeader: 'Feature', tiers: TIERS, rows: ROWS, emptyText: 'No features to gate.' },
} satisfies Meta<typeof TierMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { rows: [] } };

export const LongText: Story = {
  args: {
    rows: [row('promotions.feed', 'Promotions feed with every scheme the club runs this season', 'Promotion cards on Home, with the terms of each, the dates it runs and who it is for.', 'locked')],
  },
};

/** Two tiers only: the matrix is as wide as its tiers need. */
export const TwoTiers: Story = { args: { tiers: TIERS.slice(0, 2) } };
