import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../Button/Button.tsx';
import { SeatRow } from '../SeatRow/SeatRow.tsx';
import { Skeleton } from '../Skeleton/Skeleton.tsx';
import { TableTile, type TileSeat } from './TableTile.tsx';

const TABLE_1: TileSeat[] = ['seated', 'needsYou', 'open', 'seated', 'seated', 'open', 'seated', 'needsYou', 'open'];
const QUIET: TileSeat[] = ['open', 'open', 'seated', 'open', 'open', 'open', 'open', 'open', 'open'];

const seats = (
  <>
    <SeatRow number={1} name="Nakul Dhillon" meta="2 h 56 min" onSelect={() => undefined} />
    <SeatRow number={2} name="Vidya Chadha" request="Top-up" onSelect={() => undefined} />
    <SeatRow number={3} onSelect={() => undefined} />
    <SeatRow number={4} name="Chirag Bajaj" meta="3 h 56 min" onSelect={() => undefined} />
  </>
);

const meta = {
  title: 'Floor/TableTile',
  component: TableTile,
  args: { name: 'Table 1', stake: '50/100', seats: TABLE_1, isExpanded: false, onToggle: () => undefined, onSettings: () => undefined, children: seats },
  decorators: [(Story) => <div className="max-w-offer"><Story /></div>],
} satisfies Meta<typeof TableTile>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two players need the floor: gold segments, a gold line and the tile's gold inner ring. */
export const Default: Story = {};

/** Nobody needs the floor: Show seats. */
export const Quiet: Story = { args: { name: 'Table 5', stake: '100/200', seats: QUIET } };

/** Its seats shown under it, each a row to open. */
export const Expanded: Story = {
  render: function ExpandedStory(args) {
    const [isExpanded, setExpanded] = useState(true);
    return <TableTile {...args} isExpanded={isExpanded} onToggle={() => setExpanded((open) => !open)} />;
  },
};

/** Not running tonight: Closed, and the action that opens it. */
export const Closed: Story = {
  args: { name: 'Table 4', stake: '100/200', isClosed: true, openAction: <Button variant="subtle" size="small">Open table</Button> },
};

/** An empty table: every seat open. */
export const Empty: Story = { args: { name: 'Table 6', stake: '100/200', seats: Array<TileSeat>(9).fill('open') } };

/** The floor's first load: faint tiles. */
export const Loading: Story = { render: () => <Skeleton look="tiles" /> };

export const LongText: Story = { args: { name: 'Private Room upstairs by the bar', stake: '1,000/2,000 PLO', seats: TABLE_1 } };
