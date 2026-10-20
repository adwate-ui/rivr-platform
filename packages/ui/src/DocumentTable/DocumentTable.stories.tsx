import type { Meta, StoryObj } from '@storybook/react-vite';
import { DocumentTable } from './DocumentTable.tsx';

// A document's table is a static render on an A4 page (DocumentPage): it has no loading or error state.
const meta = {
  title: 'Paper/DocumentTable',
  component: DocumentTable,
  args: {
    caption: 'What the invoice is for',
    columns: [{ label: 'Description' }, { label: 'Amount', isAmount: true }],
    rows: [['Poker Academy, beginners course, 22 Nov 2026', 169_492n]],
    totals: [
      { label: 'Taxable value', paise: 169_492n },
      { label: 'CGST at 9%', paise: 15_254n },
      { label: 'SGST at 9%', paise: 15_254n },
      { label: 'Total', paise: 200_000n },
    ],
  },
} satisfies Meta<typeof DocumentTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No rows and no totals: the column headers alone. */
export const Empty: Story = { args: { rows: [], totals: undefined } };

export const LongText: Story = {
  args: {
    caption: 'Movements in the period',
    columns: [{ label: 'Date' }, { label: 'Description' }, { label: 'Amount', isAmount: true }, { label: 'Balance', isAmount: true }],
    rows: [
      ['1 Nov', 'Opening balance', '', 1_250_000_000n],
      ['15 Nov', 'Capital contribution by the second tranche of the partnership deed of 2026', 100_000_000n, 1_350_000_000n],
    ],
    totals: [{ label: 'Closing balance', paise: 1_350_000_000n }],
  },
};
