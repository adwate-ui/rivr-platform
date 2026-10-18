import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from '../Text/Text.tsx';
import { Inline } from './Inline.tsx';

const meta = {
  title: 'Layout/Inline',
  component: Inline,
  args: {
    gap: 4,
    children: [
      <Text key="1">Table 3</Text>,
      <Text key="2" tone="muted">
        100/200
      </Text>,
      <Text key="3" tone="muted">
        2 seats open
      </Text>,
    ],
  },
} satisfies Meta<typeof Inline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SpaceBetween: Story = { args: { justify: 'between' } };

export const LongTextWraps: Story = {
  args: {
    wrap: true,
    children: ['Black card', 'Founders’ Circle', 'Academy graduate', 'Member', 'Private Room regular', 'Tournament winner'].map((tier) => (
      <Text key={tier} variant="small">
        {tier}
      </Text>
    )),
  },
};

export const Hindi: Story = {
  globals: { locale: 'hi' },
  args: {
    children: [
      <Text key="1">टेबल 3</Text>,
      <Text key="2" tone="muted">
        100/200
      </Text>,
      <Text key="3" tone="muted">
        2 सीटें खाली
      </Text>,
    ],
  },
};
