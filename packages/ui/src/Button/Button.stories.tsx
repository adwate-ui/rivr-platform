import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline } from '../Inline/Inline.tsx';
import { Button } from './Button.tsx';

const meta = {
  title: 'Controls/Button',
  component: Button,
  args: { children: 'Join', variant: 'primary' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <Inline gap={3} wrap>
      <Button variant="primary">Seat</Button>
      <Button variant="secondary">Call</Button>
      <Button variant="text">Skip</Button>
      <Button variant="danger" icon="alert">
        Freeze venue
      </Button>
    </Inline>
  ),
};

export const Loading: Story = { args: { isLoading: true, children: 'Withdraw' } };

export const Disabled: Story = { args: { isDisabled: true, children: 'Approve' } };

export const LongText: Story = { args: { children: 'Send the withdrawal to the second approver', variant: 'secondary' } };

export const FullWidth: Story = { args: { fullWidth: true, children: 'Log hand' } };

/** The player redesign's buttons (decision 0320): the tall gold action, the outlined button and pills. */
export const PlayerRedesign: Story = {
  render: () => (
    <Inline gap={3} wrap>
      <Button variant="primary" size="tall">Send code</Button>
      <Button variant="outline">Leave waitlist</Button>
      <Button variant="outline" shape="pill">Notify me</Button>
      <Button variant="outline" shape="pill" isPressed>Notifying you</Button>
      <Button variant="primary" shape="pill">Add both</Button>
    </Inline>
  ),
};
