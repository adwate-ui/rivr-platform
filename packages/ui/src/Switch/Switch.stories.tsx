import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Stack } from '../Stack/Stack.tsx';
import { Switch } from './Switch.tsx';

// A switch has no empty or error state of its own: the screen around it says what went wrong.
const meta = {
  title: 'Controls/Switch',
  component: Switch,
  args: { label: 'Seat calls', isOn: true, onChange: () => undefined },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const On: Story = {};

export const Off: Story = { args: { isOn: false } };

export const WithHint: Story = { args: { hint: 'When your seat is ready.' } };

export const Saving: Story = { args: { isDisabled: true } };

export const LongText: Story = {
  args: { label: 'Tournament starting reminders for every event you registered for', hint: 'Thirty minutes before the first card is dealt.' },
};

export const Interactive: Story = {
  render: function Render() {
    const [seat, setSeat] = useState(true);
    const [tournaments, setTournaments] = useState(false);
    return (
      <Stack gap={2}>
        <Switch label="Seat calls" isOn={seat} onChange={setSeat} />
        <Switch label="Tournaments" isOn={tournaments} onChange={setTournaments} />
      </Stack>
    );
  },
};
