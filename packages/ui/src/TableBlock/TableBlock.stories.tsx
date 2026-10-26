import type { Meta, StoryObj } from '@storybook/react-vite';
import { TableBlock } from './TableBlock.tsx';

const meta = {
  title: 'Website/TableBlock',
  component: TableBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    heading: 'Points an hour',
    intro: 'Every hour at the tables earns points, more at higher stakes.',
    columns: ['Stake', 'Points an hour'],
    rows: [['NLH 50/100', '5'], ['NLH 100/200', '10'], ['Private Room', '20']],
    note: 'Only seated time counts; time away from the table does not.',
  },
} satisfies Meta<typeof TableBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
