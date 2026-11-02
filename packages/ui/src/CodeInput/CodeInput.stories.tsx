import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { useState } from 'react';
import { CodeInput } from './CodeInput.tsx';

// A code field has no loading or empty state beyond its empty cells; the error is the server's refusal.
const meta = {
  title: 'Forms/CodeInput',
  component: CodeInput,
  args: { label: '6-digit code', value: '', onChange: () => undefined },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <CodeInput {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof CodeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PartlyTyped: Story = { args: { value: '482' } };

export const Complete: Story = { args: { value: '482913' } };

export const Refused: Story = { args: { value: '482913', error: 'That code is wrong or has expired. Check it, or send a new one.' } };

export const Disabled: Story = { args: { value: '482913', isDisabled: true } };

export const WithHint: Story = { args: { hint: 'Sent to +91 98765 43210.' } };

export const LongText: Story = {
  args: { label: 'Code sent by SMS to +91 98765 43210, the number on the membership', value: '48', error: 'That code is wrong or has expired. Check it, or send a new one.' },
};

/** In use: the next cell's 2 px gold edge is the field's focus. */
export const Focused: Story = {
  args: { value: '48' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('textbox'));
  },
};

/** A refused code still in use: the next cell's 2 px edge is red, so the focus still shows. */
export const FocusedRefused: Story = {
  ...Refused,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('textbox'));
  },
};

/** The redesign's tall cells across the row, with the dotted error (decision 0320). */
export const Tall: Story = { args: { size: 'tall', value: '4829', error: "That code didn't match. 2 tries left." } };
