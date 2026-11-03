import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ConfirmButton } from './ConfirmButton.tsx';

const meta = {
  title: 'Controls/ConfirmButton',
  component: ConfirmButton,
  args: { label: 'Leaves', name: 'Leaves: Ritika Das', confirm: 'Yes, Ritika leaves', onConfirm: () => undefined },
} satisfies Meta<typeof ConfirmButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = { args: { variant: 'secondary', label: 'Remove', name: 'Remove: Ritika Das', confirm: 'Yes, remove Ritika' } };

/** After the first press: the danger confirmation, in the same place, with Cancel beside it. */
export const Asking: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Leaves: Ritika Das' }));
    await expect(within(canvasElement).getByRole('button', { name: 'Yes, Ritika leaves' })).toBeInTheDocument();
    await expect(within(canvasElement).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  },
};

/** The console's form (console v3): a subtle fill at the compact size. */
export const Subtle: Story = { args: { variant: 'subtle', size: 'compact', label: 'Take off the queue', confirm: 'Yes, take Ritika Das off the queue' }, tags: ['viewport-console'] };

export const Disabled: Story = { args: { isDisabled: true } };

export const LongText: Story = {
  args: { label: 'Player left', name: 'Player left: Ritika Venkataraman-Chakraborty, seat 10', confirm: 'Yes, Ritika Venkataraman-Chakraborty left seat 10' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /^Player left/ }));
  },
};

/** On the console (decision 0430): a row's small subtle button, asking in its small danger one. */
export const ConsoleRow: Story = {
  args: { variant: 'subtle', size: 'small', label: 'Delete', name: 'Delete Table 3', confirm: 'Yes, delete Table 3' },
  tags: ['viewport-console'],
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Delete Table 3' }));
  },
};
