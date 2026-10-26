import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReasonForm } from './ReasonForm.tsx';

// The form holds no data, so it has no empty state of its own: Default is the empty field.
// Cancel closes a form opened from a row; a form that stays open, as in TwoDecisions, has none.
const cancel = { onCancel: () => undefined };

const meta = {
  title: 'Controls/ReasonForm',
  component: ReasonForm,
  args: {
    field: { name: 'reason' },
    label: 'Why it is revoked',
    actions: [{ label: 'Revoke the tablet', onClick: () => undefined }],
  },
} satisfies Meta<typeof ReasonForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: cancel };

export const Loading: Story = { args: { ...cancel, field: { name: 'reason', defaultValue: 'Lost on the floor' }, isLoading: true } };

export const WithError: Story = { args: { ...cancel, error: 'Say why the tablet is revoked.' } };

/** Two decisions that take nothing away, as the KYC review has. */
export const TwoDecisions: Story = {
  args: {
    label: 'Reason for Rohan Bhatia',
    hint: 'What you saw, in your words. Never type document numbers.',
    variant: 'secondary',
    actions: [
      { label: 'Approve', onClick: () => undefined },
      { label: 'Reject', onClick: () => undefined },
    ],
  },
};

export const LongText: Story = {
  args: {
    ...cancel,
    field: { name: 'reason', defaultValue: 'The board was misread at Table 3: the river was the eight of clubs, not the eight of spades' },
    label: 'Why the payout of ₹1,20,000 to Arjun Mehta, Kabir Sethi and two others dealt in at Table 3 is reversed',
    hint: 'What happened, in your words. The members see it with your name in their history.',
    error: 'Give a reason of 3 to 500 characters with no document numbers, and a real date of birth or PAN if you enter one.',
    variant: 'secondary',
    actions: [{ label: 'Reverse the payout of ₹1,20,000 to Arjun Mehta, Kabir Sethi and two others', onClick: () => undefined }],
  },
};
