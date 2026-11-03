import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input.tsx';

const meta = {
  title: 'Controls/Input',
  component: Input,
  args: { label: 'UTR', hint: 'The 12-digit reference from your bank app.', inputMode: 'numeric' },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = { args: { defaultValue: '412908771204' } };

export const Empty: Story = { args: { hint: undefined } };

export const WithError: Story = {
  args: { defaultValue: '41290877', error: 'UTR not found. Check the 12 digits and try again.' },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: '412908771204' } };

export const LongText: Story = {
  args: {
    label: 'UPI reference number (UTR) from the bank app after the transfer',
    hint: 'Open the bank app, find the transfer to RIVR, and copy the 12-digit UTR shown under the transaction details.',
    error: 'This UTR is already linked to another deposit. Check the number, or ask the cage to look it up.',
  },
};

/** The sign-in number: an underline with the country code fixed in front. */
export const LineWithPrefix: Story = {
  args: { label: 'Mobile number', hint: undefined, type: 'tel', inputMode: 'tel', variant: 'line', prefix: '+91', defaultValue: '98110 42817' },
};

export const LineWithError: Story = {
  args: { ...LineWithPrefix.args, error: 'Enter the 10 digits of an Indian mobile number.' },
};

export const LineDisabled: Story = { args: { ...LineWithPrefix.args, disabled: true } };

/** A number with its unit after it, as Settings shows minutes, days or a percent (#603). */
export const WithSuffix: Story = {
  args: { label: 'Seat hold', hint: 'Between 1 and 120 minutes.', suffix: 'minutes', defaultValue: '15' },
};

export const WithSuffixOnAPhone: Story = { ...WithSuffix, tags: ['viewport-phone'] };

export const WithSuffixOnAPortraitTablet: Story = { ...WithSuffix, tags: ['viewport-portrait'] };

/** The player redesign's field, its label inside the box (decision 0320). */
export const Inset: Story = { args: { variant: 'inset', label: 'Full name, as on Aadhaar', placeholder: 'Ira Kapoor' } };

export const InsetWithError: Story = { args: { variant: 'inset', label: 'City', placeholder: 'Gurugram', error: 'Enter your city.' } };

/** The redesign's sign-in number, 54 px tall (decision 0320). */
export const Tall: Story = { args: { label: 'Mobile number', prefix: '+91', isTall: true, placeholder: '98765 43210' } };

/** The console's filled field beside its button (console v3): the label shown inside until something is typed. */
export const Subtle: Story = { args: { variant: 'subtle', label: 'Add: mobile or member no.' } };

export const SubtleWithError: Story = { args: { variant: 'subtle', label: 'Add: mobile or member no.', error: 'Not a member number or mobile.' } };
