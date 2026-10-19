import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { PinPad } from './PinPad.tsx';

// The pad has no loading look of its own: while the PIN is checked it is disabled.
const meta = {
  title: 'Controls/PinPad',
  component: PinPad,
  args: { label: 'PIN for Pema Lepcha', value: '', onChange: () => undefined },
} satisfies Meta<typeof PinPad>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PartlyEntered: Story = { args: { value: '27' } };

export const Checking: Story = { args: { value: '2741', isDisabled: true } };

export const WrongPin: Story = { args: { value: '', error: 'That PIN is not right. 4 tries left before the PIN locks.' } };

export const LongText: Story = {
  args: {
    label: 'PIN for Ganga Ramakrishnan Venkataraghavan, starting the down at the Private Room',
    error: 'Too many wrong PINs. This PIN is locked for 15 minutes, or until a floor manager sets a new one on the console.',
  },
};

export const Interactive: Story = {
  render: function Render() {
    const [pin, setPin] = useState('');
    return <PinPad label="PIN for Pema Lepcha" value={pin} onChange={setPin} />;
  },
};
