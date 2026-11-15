import type { Meta, StoryObj } from '@storybook/react-vite';
import { TableBlock } from './TableBlock.tsx';

const meta = {
  title: 'Website/TableBlock',
  component: TableBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    heading: 'Call time',
    intro: 'Every table has a call time, longer at higher stakes.',
    columns: ['Stake', 'Hours'],
    rows: [['NLH 50/100', '2'], ['NLH 100/200', '3'], ['Private Room', '3']],
    note: 'Only seated time counts; time away from the table does not.',
  },
} satisfies Meta<typeof TableBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = {
  args: { columns: ['Stake', 'Hours', 'A long column name'], rows: [['Private Room, 100/200', '20', 'An unusually long line, as an owner might write it in the co']], note: 'An unusually long line, as an owner might write it in the console, to see that it wraps cleanly and never breaks the band.' },
};
