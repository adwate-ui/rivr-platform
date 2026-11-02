import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from './Banner.tsx';

// A banner says one fact; it has no loading, empty or error state of its own.
const meta = {
  title: 'Feedback/Banner',
  component: Banner,
  args: { children: 'RIVR opens on Sunday 15 November.' },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Notice: Story = { args: { onDismiss: () => undefined } };

export const WithAction: Story = {
  args: { children: "Couldn't refresh. Showing 22:41.", action: { label: 'Retry', onPress: () => undefined } },
};

export const Alert: Story = { args: { tone: 'alert', children: 'The club is paused. Ask a member of staff.' } };

export const LongText: Story = {
  args: {
    children: 'Call time ends in 14 min. The floor adds time when a seat is free and nobody waits for this table.',
    action: { label: 'Add time', onPress: () => undefined },
  },
};
