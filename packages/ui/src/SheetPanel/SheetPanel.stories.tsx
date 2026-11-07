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
        <TableListRow name="Table 1 · NLH 50/100" detail="Min buy-in ₹5,000" wait="No wait" isNoWait onOpen={() => undefined} />
        <TableListRow name="Table 2 · NLH 100/200" detail="Min buy-in ₹10,000" wait="3 waiting" seatsLine="Full" onOpen={() => undefined} />
      </>
    ),
  },
} satisfies Meta<typeof SheetPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
