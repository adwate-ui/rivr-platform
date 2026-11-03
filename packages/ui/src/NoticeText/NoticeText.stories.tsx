import type { Meta, StoryObj } from '@storybook/react-vite';
import { NoticeText } from './NoticeText.tsx';

// A notice's words only: shown when there is a notice, so no loading, empty or error state of its own. English only.
const meta = {
  title: 'Domain/NoticeText',
  component: NoticeText,
  args: { text: 'Launch night is Sunday 15 November.\nDoors at 7 pm.\n\nDetails and the guest list: https://rivrpoker.com/launch.' },
} satisfies Meta<typeof NoticeText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OneLine: Story = { args: { text: 'Open till 4 tonight.' } };

export const LongText: Story = {
  args: {
    text: 'The club is closed on Diwali, Thursday 12 November, and opens again on Friday at 6 pm.\n\nTournaments that night move to Saturday; buy-ins already paid carry over. Ask the front desk about seat holds.\n\nThe full calendar for the festive week is at https://rivrpoker.com/calendar/festive-week-2026-with-every-session-and-start-time.',
  },
};
