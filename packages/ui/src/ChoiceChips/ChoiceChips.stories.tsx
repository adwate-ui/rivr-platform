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
