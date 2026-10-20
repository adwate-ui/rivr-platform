import type { Meta, StoryObj } from '@storybook/react-vite';
import { DocumentTable } from '../DocumentTable/DocumentTable.tsx';
import { DocumentPage } from './DocumentPage.tsx';

// A document is a static render for @rivr/render: it has no loading, empty or error state. It fills the
// page, so each story is shot at A4.
const ISSUER = { legalName: 'RIVR Hospitality LLP', address: 'Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram 122018', gstin: '06AAAAA0000A1Z5' };

const meta = {
  title: 'Paper/DocumentPage',
  component: DocumentPage,
  parameters: { layout: 'fullscreen' },
  tags: ['viewport-a4'],
  args: {
    issuer: ISSUER,
    title: 'Tax invoice',
    details: [
      { label: 'Invoice number', value: 'RIVR/S26/41' },
      { label: 'Date', value: '15 Nov 2026' },
      { label: 'Billed to', value: 'Arjun Mehta' },
    ],
    note: 'Computer-generated.',
    children: (
      <DocumentTable
        caption="What the invoice is for"
        columns={[{ label: 'Description' }, { label: 'Amount', isAmount: true }]}
        rows={[['Poker Academy, beginners course, 22 Nov 2026', 169_492n]]}
        totals={[
          { label: 'Taxable value', paise: 169_492n },
          { label: 'CGST at 9%', paise: 15_254n },
          { label: 'SGST at 9%', paise: 15_254n },
          { label: 'Total', paise: 200_000n },
        ]}
      />
    ),
  },
} satisfies Meta<typeof DocumentPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Invoice: Story = {};

/** A statement with no movements in the period: the opening balance, then the closing balance. */
export const EmptyStatement: Story = {
  args: {
    title: 'Statement',
    details: [
      { label: 'Account holder', value: 'Meera Kapoor' },
      { label: 'Period', value: '1 Nov 2026 to 30 Nov 2026' },
    ],
    children: (
      <DocumentTable
        caption="Movements in the period"
        columns={[{ label: 'Date' }, { label: 'Description' }, { label: 'Amount', isAmount: true }, { label: 'Balance', isAmount: true }]}
        rows={[['1 Nov', 'Opening balance', '', 50_000_000n]]}
        totals={[{ label: 'Closing balance', paise: 50_000_000n }]}
      />
    ),
  },
};

export const LongText: Story = {
  args: {
    issuer: { ...ISSUER, legalName: 'RIVR Hospitality and Entertainment Private Limited' },
    details: [
      { label: 'Invoice number', value: 'RIVR/S26/99999' },
      { label: 'Date', value: '15 Nov 2026' },
      { label: 'Billed to', value: 'Northern Gaming and Hospitality Consultants Private Limited, Tower B, DLF Cyber City' },
      { label: 'Buyer GSTIN', value: '07BBBBB1111B1Z6' },
    ],
  },
};
