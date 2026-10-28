import type { Meta, StoryObj } from '@storybook/react-vite';
import { DrillTable, type DrillSeat } from './DrillTable.tsx';

const NAMES = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

function seats(states: Partial<Record<string, Pick<DrillSeat, 'state' | 'bet'> & { plate?: string }>>): DrillSeat[] {
  return NAMES.map((name) => ({ plate: states[name]?.plate ?? name, state: states[name]?.state ?? 'folded', bet: states[name]?.bet ?? null }));
}

// A drawing has no loading or error state of its own: the session says when a spot cannot be dealt.
const meta = {
  title: 'Learn/DrillTable',
  component: DrillTable,
  decorators: [(Story) => <div className="w-96 bg-raised p-4"><Story /></div>],
  args: {
    seats: seats({ CO: { plate: 'Villain 1 · CO', state: 'in_pot', bet: '2.5 BB' }, BTN: { plate: 'You · BTN', state: 'hero', bet: null },
      SB: { state: 'yet_to_act', bet: '0.5 BB' }, BB: { state: 'yet_to_act', bet: '1 BB' } }),
    board: [],
    hole: ['A♠', 'Q♦'],
    pot: 'Pot 4 BB',
  },
} satisfies Meta<typeof DrillTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Preflop: the cut-off opened, the hero on the button to act. */
export const Default: Story = {};

/** On the turn, heads up. */
export const Turn: Story = {
  args: {
    seats: seats({ BB: { plate: 'Villain 1 · BB', state: 'in_pot', bet: '8 BB' }, BTN: { plate: 'You · BTN', state: 'hero', bet: null } }),
    board: ['K♦', '7♣', '2♥', 'J♠'], hole: ['K♠', 'Q♠'], pot: 'Pot 12 BB',
  },
};

/** No pot yet, everyone still to act. */
export const Empty: Story = {
  args: { seats: NAMES.map((name) => ({ plate: name === 'UTG' ? 'You · UTG' : name, state: name === 'UTG' ? 'hero' : 'yet_to_act', bet: null })), board: [], pot: null },
};

/** The longest plates fit their seats. */
export const LongText: Story = {
  args: {
    seats: seats({ HJ: { plate: 'Villain 2 · HJ', state: 'in_pot', bet: '100 BB' }, CO: { plate: 'Villain 1 · CO', state: 'in_pot', bet: '24.5 BB' },
      BTN: { plate: 'You · BTN', state: 'hero', bet: null } }),
    board: ['A♥', 'T♣', 'T♦', '9♠', '9♥'], hole: ['A♣', 'A♦'], pot: 'Pot 150.5 BB',
  },
};
