import type { Meta, StoryObj } from '@storybook/react-vite';
import { Grid } from '../Grid/Grid.tsx';
import { RoundAction } from './RoundAction.tsx';

// A round action asks the floor for something; while that waits it is pending, its only other state.
const meta = {
  title: 'Controls/RoundAction',
  component: RoundAction,
  args: { icon: 'topUp', label: 'Top up', onPress: () => undefined },
} satisfies Meta<typeof RoundAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pending: Story = { args: { isPending: true } };

export const SeatActions: Story = {
  render: () => (
    <Grid columns={3} gap={2}>
      <RoundAction icon="topUp" label="Top up" onPress={() => undefined} isPending />
      <RoundAction icon="addTime" label="Add time" onPress={() => undefined} />
      <RoundAction icon="leave" label="Leave seat" onPress={() => undefined} />
    </Grid>
  ),
};
