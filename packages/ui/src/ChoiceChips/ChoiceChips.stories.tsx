import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChoiceChips } from './ChoiceChips.tsx';

const GAMES = [
  { value: 'nlh', label: 'NLH' },
  { value: 'plo', label: 'PLO' },
  { value: 'tournaments', label: 'Tournaments' },
] as const;

// Chips have no error state of its own: the screen around them says what went wrong.
const meta = {
  title: 'Controls/ChoiceChips',
  component: ChoiceChips,
  args: { label: 'Games', options: GAMES, selected: ['nlh', 'tournaments'], onChange: () => undefined },
} satisfies Meta<typeof ChoiceChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoneChosen: Story = { args: { selected: [] } };

export const OneStake: Story = {
  args: {
    label: 'Stake',
    mode: 'one',
    options: [
      { value: '50/100', label: '50/100' },
      { value: '100/200', label: '100/200' },
    ],
    selected: ['100/200'],
  },
};

export const Saving: Story = { args: { isDisabled: true } };

/** A filter on a phone: one row that scrolls, fading at its end (the member's Rewards). */
export const OneRowOnAPhone: Story = {
  args: {
    label: 'Show', mode: 'one', selected: ['all'],
    options: [
      { value: 'all', label: 'All' }, { value: 'dining', label: 'Dining' }, { value: 'stay', label: 'Hotel nights' },
      { value: 'merch', label: 'Merchandise' }, { value: 'experience', label: 'Experiences' },
    ],
    isOneRow: true,
  },
  tags: ['!viewport-console', 'viewport-phone'],
};

export const LongText: Story = {
  args: {
    label: 'Games you want to hear about when a seat opens',
    options: [
      { value: 'nlh', label: "No-limit Texas hold'em" },
      { value: 'plo', label: 'Pot-limit Omaha, four and five cards' },
      { value: 'tournaments', label: 'Tournaments and satellites' },
    ],
    selected: ['plo'],
  },
};

/** In a table cell under its column's header: the label is for screen readers only. */
export const LabelVisuallyHidden: Story = {
  render: () => (
    <ChoiceChips label="Learn library for Member" selected={['locked']} onChange={() => undefined} isLabelVisuallyHidden
      options={[{ value: 'on', label: 'On' }, { value: 'locked', label: 'Locked' }, { value: 'hidden', label: 'Hidden' }]} />
  ),
};

export const Interactive: Story = {
  render: function Render() {
    const [games, setGames] = useState<string[]>(['nlh']);
    return <ChoiceChips label="Games" options={GAMES} selected={games} onChange={setGames} />;
  },
};

/** The redesign's pills, picked in gold tint (decision 0320). */
export const Pills: Story = {
  args: { look: 'pill', mode: 'one', isOneRow: true, label: 'Filter', selected: ['all'],
    options: [{ value: 'all', label: 'All' }, { value: 'seats', label: 'Tournament seats' }, { value: 'fnb', label: 'F&B' }, { value: 'merch', label: 'Merch' }] },
};

/** The redesign's tiles: a rating of 1 to 5, or Add time's three lengths. */
export const Tiles: Story = {
  args: { look: 'tile', mode: 'one', label: 'Add time', selected: ['60'],
    options: [{ value: '30', label: '30 min' }, { value: '60', label: '1 hour' }, { value: '120', label: '2 hours' }] },
};

/** The Order screen's categories, underlined in gold (decision 0320). */
export const Tabs: Story = {
  args: { look: 'tabs', mode: 'one', label: 'Menu', isLabelVisuallyHidden: true, selected: ['food'],
    options: [{ value: 'food', label: 'Food' }, { value: 'soft', label: 'Soft drinks' }, { value: 'bar', label: 'Bar' }] },
};
