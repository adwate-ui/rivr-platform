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

export const Hindi: Story = { globals: { locale: 'hi' }, args: { label: 'सेक्शन', sections: consoleSections('hi') } };
