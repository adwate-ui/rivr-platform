import type { Meta, StoryObj } from '@storybook/react-vite';
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
