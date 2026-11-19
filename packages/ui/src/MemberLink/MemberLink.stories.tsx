import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { RequestItem } from '../RequestItem/RequestItem.tsx';
import { SeatRow } from '../SeatRow/SeatRow.tsx';
import { Text } from '../Text/Text.tsx';
import { MemberLink, MemberLinksProvider, type MemberLinks } from './MemberLink.tsx';

// Every name opens the member's account; a viewer who may not open it sees plain text. The name is data the screen already
// has, so the link has no loading, empty or error state of its own.
const LINKS: MemberLinks = { hrefOf: (memberId) => `#members?member=${memberId}`, onNavigate: () => undefined };
const NO_LINKS: MemberLinks = { hrefOf: () => undefined };

const meta = {
  title: 'Navigation/MemberLink',
  component: MemberLink,
  args: { memberId: 'm-1', children: 'Vidya Chadha' },
  decorators: [(Story) => <Box surface="raised" padding={4}><Text variant="row"><Story /></Text></Box>],
} satisfies Meta<typeof MemberLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { decorators: [(Story) => <MemberLinksProvider links={LINKS}><Story /></MemberLinksProvider>] };

/** A viewer without Members: the name as plain text. */
export const NotOpenable: Story = { decorators: [(Story) => <MemberLinksProvider links={NO_LINKS}><Story /></MemberLinksProvider>] };

export const LongText: Story = {
  args: { children: 'Venkataraghavan Subramaniam-Krishnamurthy' },
  decorators: [(Story) => <MemberLinksProvider links={LINKS}><Story /></MemberLinksProvider>],
};

/** In a seat tile: the name is the link, the rest of the row opens the seat. */
export const InsideATile: Story = {
  render: () => (
    <MemberLinksProvider links={LINKS}>
      <SeatRow number={2} name="Vidya Chadha" memberId="m-1" request="Top-up" onSelect={() => undefined} />
      <RequestItem kind="Top-up" age="4 min" title="Ritika Bhalla" memberId="m-2" detail="Table 1, seat 5" onTitle={() => undefined}
        primary={{ label: 'Start', onClick: () => undefined }} secondary={{ label: 'Decline', onClick: () => undefined }} />
    </MemberLinksProvider>
  ),
};
