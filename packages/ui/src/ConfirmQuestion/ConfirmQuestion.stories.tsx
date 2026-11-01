import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfirmQuestion } from './ConfirmQuestion.tsx';

const meta = {
  title: 'Controls/ConfirmQuestion',
  component: ConfirmQuestion,
  args: { question: "Change Ayesha Thomas's role to Host?", confirm: 'Yes, change it', onConfirm: () => undefined, onCancel: () => undefined },
} satisfies Meta<typeof ConfirmQuestion>;

export default meta;
type Story = StoryObj<typeof meta>;

// No empty or error story: the question is shown only for a change picked, and the screen shows a save's failure.
export const Default: Story = {};

/** While the change is saved. */
export const Busy: Story = { args: { isBusy: true } };

export const LongText: Story = {
  args: { question: 'Take a break until Wed 2 Dec, 23:40? It cannot be shortened, and waitlists and buy-ins stay closed to you until then.', confirm: 'Yes, take the break' },
};
