import type { Meta, StoryObj } from '@storybook/react-vite';
import { Money } from '../Money/Money.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { HistoryRow } from './HistoryRow.tsx';

const meta = {
  title: 'Data/HistoryRow',
  component: HistoryRow,
  args: { when: '13 Feb 2026', title: 'Table 2', value: <Money paise={2_650_000n} signed tone="player" />, detail: '100/200 · 6 h 30 min', onOpen: () => {} },
} satisfies Meta<typeof HistoryRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A session that lost: the net in the plain tone. */
export const Loss: Story = { args: { when: '2 Feb 2026', title: 'Table 3', value: <Money paise={-5_260_000n} signed />, detail: '100/200 · 3 h 15 min' } };

export const LongText: Story = {
  args: { title: 'Private Room with a much longer name than any table has, and 2 more', detail: '1,000/2,000 · 14 h 50 min, with a straddle on every hand' },
};

/** Rows as a history lists them, divided. */
export const InAList: Story = {
  render: (args) => (
    <Stack divided>
      <HistoryRow {...args} />
      <HistoryRow {...args} when="10 Feb 2026" title="Table 3" value={<Money paise={-1_000_000n} signed />} detail="100/200 · 3 h 15 min" />
    </Stack>
  ),
};
