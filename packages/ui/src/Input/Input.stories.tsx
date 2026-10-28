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

/** The one-time code: large and letter-spaced. */
export const Code: Story = {
  args: { label: 'Code', hint: 'Sent to +91 98110 42817', variant: 'code', inputMode: 'numeric', placeholder: '6 digits', autoComplete: 'one-time-code' },
};

export const CodeWithError: Story = {
  args: { ...Code.args, defaultValue: '482913', error: 'Code expired. Request a new one.' },
};

/** A number with its unit after it, as Settings shows minutes, days or a percent (#603). */
export const WithSuffix: Story = {
  args: { label: 'Seat hold', hint: 'Between 1 and 120 minutes.', suffix: 'minutes', defaultValue: '15' },
};

export const WithSuffixOnAPhone: Story = { ...WithSuffix, tags: ['viewport-phone'] };

export const WithSuffixOnAPortraitTablet: Story = { ...WithSuffix, tags: ['viewport-portrait'] };
