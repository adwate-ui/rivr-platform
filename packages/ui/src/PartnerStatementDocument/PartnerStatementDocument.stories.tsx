import { documents, registerMessages } from '@rivr/i18n';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PartnerStatementDocument, type PartnerStatement } from './PartnerStatementDocument.tsx';

// A statement is a static document: it has no loading or error state. Shot at A4.
registerMessages({ documents });

const STATEMENT: PartnerStatement = {
  issuer: { legalName: 'RIVR Hospitality LLP', address: 'Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram 122018', gstin: '06AAAAA0000A1Z5' },
  holder: 'Kabir Malhotra',
  kind: 'partner',
  month: '2026-11-01',
  heldOn: '2026-11-30',
  basisPoints: 1250,
  revenue: [{ name: 'Rake', paise: 4_250_000_00n }, { name: 'Academy fees', paise: 36_000_00n }],
  expenses: [{ name: 'Bonus issued', paise: 62_500_00n }, { name: 'High hands paid', paise: 18_000_00n }, { name: 'Expense: Staff meals', paise: 9_450_00n }],
  revenuePaise: 4_286_000_00n,
  expensePaise: 89_950_00n,
  netPaise: 4_196_050_00n,
  sharePaise: 524_506_25n,
  isProvisional: false,
};

const meta = {
  title: 'Paper/PartnerStatementDocument',
  component: PartnerStatementDocument,
  parameters: { layout: 'fullscreen' },
  tags: ['viewport-a4'],
  args: { statement: STATEMENT },
} satisfies Meta<typeof PartnerStatementDocument>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** As the console shows it, with Back and Save as PDF above the page. */
export const WithSave: Story = { args: { onSave: () => undefined, onBack: () => undefined } };

/** An investor's, in a month that lost money: the loss is shared as a profit is. */
export const InvestorLoss: Story = {
  args: {
    statement: {
      ...STATEMENT, holder: 'Northbridge Capital', kind: 'investor', basisPoints: 3333,
      revenue: [{ name: 'Rake', paise: 9_000_00n }], expenses: [{ name: 'Expense: Rent', paise: 19_000_00n }],
      revenuePaise: 9_000_00n, expensePaise: 19_000_00n, netPaise: -10_000_00n, sharePaise: -3_333_00n,
    },
  },
};

/** Before the month's MIS is stored on the 1st: marked provisional. */
export const Provisional: Story = { args: { statement: { ...STATEMENT, isProvisional: true } } };

/** A month with nothing posted. */
export const Empty: Story = { args: { statement: { ...STATEMENT, revenue: [], expenses: [], revenuePaise: 0n, expensePaise: 0n, netPaise: 0n, sharePaise: 0n } } };

export const LongText: Story = {
  args: {
    statement: {
      ...STATEMENT, holder: 'The Northern Gaming and Hospitality Investment Partnership of Gurugram',
      expenses: [...STATEMENT.expenses, { name: 'Expense: Repairs to the air conditioning in the Private Room and the card room', paise: 1_25_000_00n }],
      expensePaise: 2_14_950_00n, netPaise: 40_71_050_00n, sharePaise: 5_08_881_25n,
    },
  },
};
