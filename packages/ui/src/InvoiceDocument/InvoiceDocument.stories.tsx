import { documents, registerMessages } from '@rivr/i18n';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { InvoiceDocument, type StoredInvoice } from './InvoiceDocument.tsx';

// An invoice is a static document: it has no loading, empty or error state. Shot at A4.
registerMessages({ documents });

const STORED: StoredInvoice = {
  number: 'RIVR/A26/41',
  isTaxInvoice: true,
  issuedAt: '2026-11-15T13:30:00Z',
  supplier: { legalName: 'RIVR Hospitality LLP', gstin: '06AAAAA0000A1Z5', address: 'Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram 122018' },
  buyer: { name: 'Arjun Mehta', gstin: null },
  description: 'Poker Academy, Level 1, November',
  rateBasisPoints: 1800,
  taxablePaise: 169_492n,
  cgstPaise: 15_254n,
  sgstPaise: 15_254n,
  igstPaise: 0n,
  totalPaise: 200_000n,
  sacCode: '999293',
  placeOfSupply: 'Haryana',
  signatory: { name: 'Rhea Kapoor', designation: 'Partner' },
};

const meta = {
  title: 'Paper/InvoiceDocument',
  component: InvoiceDocument,
  parameters: { layout: 'fullscreen' },
  tags: ['viewport-a4'],
  args: { invoice: STORED },
} satisfies Meta<typeof InvoiceDocument>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** As the player app shows it, with Save as PDF above the page. */
export const WithSave: Story = { args: { onSave: () => undefined } };

/** A company in another state, under its GSTIN: IGST alone. */
export const Igst: Story = {
  args: {
    invoice: {
      ...STORED, buyer: { name: 'Southern Cards Private Limited', gstin: '29CCCCC2222C1Z7' }, description: 'Poker Academy, Level 1, November, 2 heads',
      taxablePaise: 254_237n, cgstPaise: 0n, sgstPaise: 0n, igstPaise: 45_763n, totalPaise: 300_000n,
    },
  },
};

/** The practice venue's: never a tax invoice, and no supplier GSTIN. */
export const Practice: Story = {
  args: { invoice: { ...STORED, isTaxInvoice: false, supplier: { ...STORED.supplier, gstin: null }, sacCode: null, placeOfSupply: null, signatory: null } },
};

export const LongText: Story = {
  args: {
    invoice: {
      ...STORED, buyer: { name: 'The Northern Gaming and Hospitality Company of Gurugram Private Limited', gstin: '06BBBBB1111B1Z6' },
      description: 'Poker Academy, Level 1 for beginners, the November weekday evening batch at the club, 12 heads booked by the company',
    },
  },
};
