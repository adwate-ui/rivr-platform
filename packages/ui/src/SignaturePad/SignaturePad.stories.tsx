import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignaturePad } from './SignaturePad.tsx';

const meta = {
  title: 'Controls/SignaturePad',
  component: SignaturePad,
  args: { label: 'Signature of Neel Bose for ₹10,000', onChange: () => undefined },
} satisfies Meta<typeof SignaturePad>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty, waiting for the member to sign. */
export const Default: Story = {};

/** Signed: the stroke shows until it is cleared. */
export const Signed: Story = { args: { label: 'Signature of Neel Bose for ₹10,000', defaultValue: 'M 20 60 C 60 10, 90 90, 130 50 S 200 20, 260 55' } };

/** A long name and amount. */
export const LongText: Story = { args: { label: 'Signature of Karma Tsering Bhutia Wangchuk for a marker of ₹1,50,000' } };
