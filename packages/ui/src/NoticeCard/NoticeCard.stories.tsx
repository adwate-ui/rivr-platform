import type { Meta, StoryObj } from '@storybook/react-vite';
import { NoticeCard } from './NoticeCard.tsx';

// Tonight shows the card only when a notice runs, so it has no loading, empty or error state of its own. English only.
const meta = {
  title: 'Domain/NoticeCard',
  component: NoticeCard,
  tags: ['viewport-phone'],
  args: { label: 'From the club', text: 'Launch night is Sunday 15 November.\nDoors at 7 pm.\n\nDetails: https://rivrpoker.com/launch' },
} satisfies Meta<typeof NoticeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OneLine: Story = { args: { text: 'Open till 4 tonight.' } };

export const LongText: Story = {
  args: {
    text: 'The club is closed on Diwali, Thursday 12 November, and opens again on Friday at 6 pm.\n\nTournaments that night move to Saturday; buy-ins already paid carry over. Ask the front desk about seat holds.\n\nThe full calendar for the festive week is at https://rivrpoker.com/calendar/festive-week-2026-with-every-session-and-start-time.',
  },
};
