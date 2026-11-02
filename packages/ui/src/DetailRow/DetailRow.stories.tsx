import type { Meta, StoryObj } from '@storybook/react-vite';
import { DetailRow } from './DetailRow.tsx';

// A row shows one fact; the list around it carries any loading, empty or error state.
const meta = {
  title: 'Data/DetailRow',
  component: DetailRow,
  args: { label: 'Game', value: 'NLH 50/100', labelTone: 'muted' },
} satisfies Meta<typeof DetailRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Status: Story = { args: { label: 'Top-up', value: 'Requested', labelTone: 'default', valueTone: 'accent', hasDot: true, size: 'small' } };

export const Opens: Story = { args: { label: 'House rules', value: undefined, labelTone: 'default', onOpen: () => undefined } };

export const Last: Story = { args: { label: 'Played', value: '4h 05m', isLast: true } };

export const LongText: Story = { args: { label: 'Sunday Main Event seat, collect at the host desk', value: 'Ready to collect', valueTone: 'accent' } };
