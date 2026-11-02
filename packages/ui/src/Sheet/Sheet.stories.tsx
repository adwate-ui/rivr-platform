import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { Sheet } from './Sheet.tsx';

// A sheet holds what a screen asks; its content carries any loading or error state.
const meta = {
  title: 'Controls/Sheet',
  component: Sheet,
  parameters: { layout: 'fullscreen' },
  args: {
    isOpen: true,
    onClose: () => undefined,
    title: 'Top up',
    children: (
      <Stack gap={4}>
        <Button variant="primary" size="tall" fullWidth>Request top-up</Button>
        <Button variant="text" fullWidth>Cancel</Button>
      </Stack>
    ),
  },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithEyebrow: Story = { args: { eyebrow: 'Redeem', title: 'Bar upgrade, one night' } };

export const PlainWithAside: Story = {
  args: { title: 'Occupation', titleLook: 'plain', aside: 'Choose one', children: <Text tone="muted">Options</Text> },
};

export const LongText: Story = {
  args: { eyebrow: 'Private Room', title: "No-Limit Hold'em 100/200 with a straddle and a bomb pot every orbit" },
};
