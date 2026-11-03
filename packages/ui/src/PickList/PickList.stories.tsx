import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '../Input/Input.tsx';
import { PickList } from './PickList.tsx';

const CHECKS = [
  { label: 'To review', count: 2, items: [{ id: 'r1', title: 'Rohan Bhatia', detail: 'PAN alone · 11:42' }, { id: 'r2', title: 'Naina Kapoor', detail: 'DigiLocker · 11:42' }] },
  { label: 'Waiting on the member', count: 2, items: [{ id: 'w1', title: 'Puneet Agarwal', detail: 'Needs a PAN · since 11:23' }, { id: 'w2', title: 'Charu Taneja', detail: 'Needs a PAN · since 11:23' }] },
];

const meta = {
  title: 'Navigation/PickList',
  component: PickList,
  tags: ['viewport-console'],
  args: { label: 'Checks', groups: CHECKS, current: 'r1', onPick: () => undefined, emptyText: 'Nothing to check.' },
} satisfies Meta<typeof PickList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The website's pages: a search field above, the groups under it, nothing open yet. */
export const WithSearch: Story = {
  args: {
    label: 'Pages', current: null, emptyText: 'No page matches.',
    search: <Input type="search" variant="subtle" label="Find a page" value="" onChange={() => undefined} />,
    groups: [
      { label: 'Club', items: [{ id: 'about', title: 'About' }, { id: 'home', title: 'Home' }, { id: 'house-rules', title: 'House rules' }] },
      { label: 'Legal', items: [{ id: 'privacy', title: 'Privacy' }, { id: 'terms', title: 'Terms of use' }] },
    ],
  },
};

/** One kind of item: no heading over them. */
export const OneKind: Story = {
  args: { label: 'Lapsed regulars', current: 'h1', groups: [{ items: [{ id: 'h1', title: 'Ritika Bhalla', detail: 'last here 4 Oct 2026 · 4 visits before that' }] }] },
};

export const Empty: Story = { args: { groups: [{ label: 'To review', items: [] }] } };

/** A long name and line wrap within the panel. */
export const LongText: Story = {
  args: {
    groups: [{ label: 'Waiting on the member, a heading much longer than any the console has', count: 1, items: [{
      id: 'l1', title: 'Arjun Mehta, who has a much longer name than any member has',
      detail: 'Needs a PAN · since 11:23 · and a line much longer than any the console writes under a name',
    }] }],
  },
};

/** On a phone the rows stay 44 px targets. */
export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };
