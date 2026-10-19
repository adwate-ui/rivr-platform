import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Keypad } from './Keypad.tsx';

// The keypad has no loading or error look of its own: the screen around it shows the pot and what
// went wrong, and disables it while a hand is logged.
const meta = {
  title: 'Controls/Keypad',
  component: Keypad,
  args: { label: 'Pot', value: '', onChange: () => undefined },
} satisfies Meta<typeof Keypad>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Entered: Story = { args: { value: '48000' } };

export const Logging: Story = { args: { value: '48000', isDisabled: true } };

export const LongText: Story = { args: { label: 'Final pot at the end of the hand, in whole rupees, before the rake is pulled' } };

export const Interactive: Story = {
  render: function Render() {
    const [pot, setPot] = useState('');
    return <Keypad label="Pot" value={pot} onChange={setPot} />;
  },
};
