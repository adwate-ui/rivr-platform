import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CommandPalette, type PaletteGroup } from './CommandPalette.tsx';
import { SearchTrigger } from './SearchTrigger.tsx';

const GROUPS: PaletteGroup[] = [
  { id: 'members', label: 'Members', items: [
    { id: 'm1', label: 'Ritika Bhalla', meta: 'Table 1, seat 3', onSelect: () => undefined },
    { id: 'm2', label: 'Rajesh Saini', meta: 'No. 1042 · Founders’ Circle', onSelect: () => undefined },
  ] },
  { id: 'actions', label: 'Actions', items: [
    { id: 'a1', label: 'Seat a player', meta: 'S', onSelect: () => undefined },
    { id: 'a2', label: 'Add to a waitlist', meta: 'Action', onSelect: () => undefined },
  ] },
  { id: 'screens', label: 'Screens', items: [
    { id: 's1', label: 'Live floor', meta: 'Screen', onSelect: () => undefined },
    { id: 's2', label: 'Waitlist', meta: 'Screen', onSelect: () => undefined },
  ] },
];

const meta = {
  title: 'Navigation/CommandPalette',
  component: CommandPalette,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: { isOpen: true, onOpenChange: () => undefined, query: '', onQueryChange: () => undefined, groups: GROUPS },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Members, actions and screens, as the app gives them; the first marked. */
export const Default: Story = {};

export const Loading: Story = { args: { status: 'loading', groups: [] } };

export const Empty: Story = { args: { query: 'zz', groups: [] } };

export const WithError: Story = { args: { status: 'error', groups: [] } };

export const LongText: Story = {
  args: {
    groups: [{ id: 'members', label: 'Members', items: [
      { id: 'm1', label: 'Venkataraghavan Subramaniam-Krishnamurthy', meta: 'Private Room with a long name, seat 9', onSelect: () => undefined },
    ] }],
  },
};

export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };

/** The header's search at a desk, closed; below 768 px it is a search button. */
export const Trigger: Story = {
  tags: ['!viewport-console'],
  parameters: { layout: 'padded' },
  render: function TriggerStory() {
    const [isOpen, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    return (
      <>
        <SearchTrigger onOpen={() => setOpen(true)} />
        <CommandPalette isOpen={isOpen} onOpenChange={setOpen} query={query} onQueryChange={setQuery} groups={GROUPS} />
      </>
    );
  },
};
