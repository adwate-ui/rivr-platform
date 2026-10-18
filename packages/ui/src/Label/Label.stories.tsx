import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from './Label.tsx';

const meta = {
  title: 'Type/Label',
  component: Label,
  args: { htmlFor: 'payout-account', children: 'Payout account' },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = { args: { children: 'UPI reference number (UTR) from the bank app after the transfer' } };
