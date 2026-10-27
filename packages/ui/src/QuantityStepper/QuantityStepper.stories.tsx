import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Box } from '../Box/Box.tsx';
import { QuantityStepper } from './QuantityStepper.tsx';

const meta = {
  title: 'Forms/QuantityStepper',
  component: QuantityStepper,
  args: { label: 'Masala chai', value: 0, onChange: () => undefined },
  decorators: [(Story) => <Box padding={4}><Story /></Box>],
  render: function Counted(args) {
    const [value, setValue] = useState(args.value);
    return <QuantityStepper {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof QuantityStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** None yet: one fewer is off. */
export const Default: Story = {};

export const Counted: Story = { args: { value: 2 } };

/** Nine, the most a line takes: one more is off. */
export const AtMost: Story = { args: { value: 9 } };

export const LongText: Story = { args: { label: 'Grilled paneer tikka with mint chutney and onion rings', value: 1 } };
