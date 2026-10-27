import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { consoleSections } from '../storybook/fixtures.ts';
import { SideNav } from './SideNav.tsx';

const meta = {
  title: 'Navigation/SideNav',
  component: SideNav,
  args: { label: 'Sections', sections: consoleSections(), current: 'cage' },
  decorators: [
    (Story) => (
      <Box surface="raised" padding={4}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof SideNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { sections: [] } };

/** High hands with two claims waiting for the floor (#317). */
export const WithCount: Story = {
  args: {
    current: 'liveFloor',
    sections: [
      { id: 'floor', label: 'Floor', items: [{ id: 'liveFloor', label: 'Live floor', href: '#floor' }] },
      { id: 'growth', label: 'Growth', items: [
        { id: 'jackpots', label: 'Jackpots', href: '#jackpots' },
        { id: 'highHands', label: 'High hands', href: '#high-hands', count: 2 },
      ] },
    ],
  },
};

export const LongText: Story = {
  args: {
    current: 'long',
    sections: [
      {
        id: 'money',
        label: 'Money and settlement across every venue',
        items: [{ id: 'long', label: 'Withdrawals waiting for a second approver above ₹1,00,000', href: '#long' }],
      },
    ],
  },
};
