import type { Meta, StoryObj } from '@storybook/react-vite';
import { TableListRow } from '../TableListRow/TableListRow.tsx';
import { SheetPanel } from './SheetPanel.tsx';

// The panel holds a list; the list carries any loading, empty or error state.
const meta = {
  title: 'Layout/SheetPanel',
  component: SheetPanel,
  tags: ['viewport-phone'],
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'All tables',
    aside: '4 running',
    children: (
      <>
        <TableListRow name="Table 1 · NLH 50/100" openSeats={3} wait="No wait" isNoWait seatsLine="3 open" onOpen={() => undefined} />
        <TableListRow name="Table 2 · NLH 100/200" openSeats={0} wait="3 waiting" seatsLine="Full" onOpen={() => undefined} />
      </>
    ),
  },
} satisfies Meta<typeof SheetPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
