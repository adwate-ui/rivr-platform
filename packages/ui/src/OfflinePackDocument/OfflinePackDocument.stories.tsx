import { documents, registerMessages } from '@rivr/i18n';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { OfflinePackDocument } from './OfflinePackDocument.tsx';
import { PACK } from './offlinePack.fixture.ts';

// A pack is a static document: it has no loading or error state. Shot at A4: its first page.
registerMessages({ documents });

const meta = {
  title: 'Paper/OfflinePackDocument',
  component: OfflinePackDocument,
  parameters: { layout: 'fullscreen' },
  tags: ['viewport-a4'],
  args: { pack: PACK },
} satisfies Meta<typeof OfflinePackDocument>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A quiet night: nobody to call yet, nothing held or owed, no table open, no SOP. */
export const Empty: Story = {
  args: {
    pack: { ...PACK, contacts: [], balances: [], walletsPaise: 0n, markersPaise: 0n, chipsInPlayPaise: 0n, tables: [], waitlist: [], sops: [] },
  },
};

export const LongText: Story = {
  args: {
    pack: {
      ...PACK,
      venueName: 'RIVR Gurugram, upper floor of Glaza, M3M 65th Avenue',
      contacts: [{ kind: 'vendor', name: 'Kitchen equipment service, emergency line for the bar and kitchen', role: 'Account manager', phone: '+91 98100 00099', note: 'Out of hours: leave a message with the table and the fault' }],
    },
  },
};
