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

/** A filled history at a phone's width: a reason with no spaces to break at, a large figure, and points taken away. */
export const FilledHistoryOnAPhone: Story = {
  tags: ['viewport-phone'],
  render: () => (
    <>
      <DetailRow label="Promised_by_the_floor_manager_for_the_whole_of_the_long_weekend · 15 Nov" value="+12,34,567" />
      <DetailRow label="Redeemed: Sunday Main Event seat, collected at the cage · 14 Nov" value="−4,00,000" valueTone="muted" />
      <DetailRow label="Points for the visit · 13 Nov" value="+250" isLast />
    </>
  ),
};

export const LongText: Story = { args: { label: 'Sunday Main Event seat, collect at the host desk', value: 'Ready to collect', valueTone: 'accent' } };
