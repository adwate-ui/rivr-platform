import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { Money } from '../Money/Money.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { ScrollArea } from './ScrollArea.tsx';

const rows = (label: string, count: number) =>
  Array.from({ length: count }, (_, index) => (
    <Inline key={index} justify="between">
      <Text>{`${label} ${index + 1}`}</Text>
      <Money paise={BigInt((index + 1) * 250_000)} />
    </Inline>
  ));

const meta = {
  title: 'Layout/ScrollArea',
  component: ScrollArea,
  args: { label: 'Movements', children: <Stack gap={3}>{rows('Buy-in', 20)}</Stack> },
  decorators: [
    (Story) => (
      <Box surface="raised" padding={4}>
        <div className="h-32">
          <Story />
        </div>
      </Box>
    ),
  ],
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { children: <Text tone="muted">No movements yet.</Text> } };

export const LongText: Story = {
  args: {
    children: (
      <Text>
        Every buy-in, cash-out, deposit, withdrawal, bonus release and marker settlement on the account appears here in the order it happened,
        with the table, the time in IST and the staff member who recorded it. The list keeps the last ninety days; older movements are in the
        monthly statement sent by email on the first of each month.
      </Text>
    ),
  },
};

export const Hindi: Story = {
  globals: { locale: 'hi' },
  args: { label: 'लेन-देन', children: <Stack gap={3}>{rows('बाय-इन', 20)}</Stack> },
};
