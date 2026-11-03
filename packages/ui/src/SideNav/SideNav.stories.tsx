import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { consoleSections } from '../storybook/fixtures.ts';
import { SideNav } from './SideNav.tsx';

const meta = {
  title: 'Navigation/SideNav',
  component: SideNav,
  args: { label: 'Sections', sections: consoleSections(), current: 'floor' },
  decorators: [
    (Story) => (
      <Box surface="raised" padding={3}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof SideNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The rail with its labels: counts in gold ask for action, muted ones inform; Admin folded. */
export const Default: Story = {};

export const Empty: Story = { args: { sections: [] } };

/** An Admin screen open: its group stays open, the danger screens in the danger colour. */
export const AdminOpen: Story = { args: { current: 'kill' } };

/** Folded to icons: no headings, each count a dot, every screen shown. */
export const Collapsed: Story = { args: { isCollapsed: true } };

export const LongText: Story = {
  args: {
    current: 'long',
    sections: [
      {
        id: 'tonight',
        label: 'Tonight and every night after it at the club',
        items: [{ id: 'long', label: 'Withdrawals waiting for a second approver', href: '#long', icon: 'requests', count: 128, isActionable: true }],
      },
    ],
  },
};
