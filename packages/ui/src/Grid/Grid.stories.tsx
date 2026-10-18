import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { Text } from '../Text/Text.tsx';
import { Grid } from './Grid.tsx';

const cell = (label: string) => (
  <Box key={label} surface="raised" padding={4} radius="lg">
    <Text>{label}</Text>
  </Box>
);

const meta = {
  title: 'Layout/Grid',
  component: Grid,
  args: { columns: 3, children: ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Private Room'].map(cell) },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FiveColumns: Story = { args: { columns: 5, gap: 2 } };

export const LongText: Story = {
  args: {
    columns: 2,
    children: [
      cell('Rake tonight across the main room and the Private Room, before jackpot drops'),
      cell('Hands per hour on Table 3 since the start of the current down'),
    ],
  },
};
