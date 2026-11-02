import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stepper } from './Stepper.tsx';

const STEPS = ['Sent', 'Preparing', 'On its way', 'Delivered'];

// The stepper draws where an order stands; the tracker around it carries any loading or error state.
const meta = {
  title: 'Data/Stepper',
  component: Stepper,
  args: { steps: STEPS, current: 2, label: 'Order' },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnItsWay: Story = {};

export const Sent: Story = { args: { current: 0 } };

export const Delivered: Story = { args: { current: 3 } };
