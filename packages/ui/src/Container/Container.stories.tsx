import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { Text } from '../Text/Text.tsx';
import { Container } from './Container.tsx';

const meta = {
  title: 'Layout/Container',
  component: Container,
  args: {
    width: 'text',
    children: (
      <Box surface="raised" padding={4}>
        <Text>House rules</Text>
      </Box>
    ),
  },
} satisfies Meta<typeof Container>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PhoneWidth: Story = { args: { width: 'phone' } };

export const LongText: Story = {
  args: {
    children: (
      <Text>
        Members play under the house rules of RIVR Poker Club. A seat called from the waitlist is held for fifteen minutes. One player to a hand.
        English or Hindi at the table. Phones away from the felt during a hand. The floor’s decision is final on the night and can be
        reviewed with the manager the next day.
      </Text>
    ),
  },
};

export const Hindi: Story = {
  globals: { locale: 'hi' },
  args: {
    children: (
      <Text>
        सदस्य RIVR पोकर क्लब के नियमों के तहत खेलते हैं। वेटलिस्ट से बुलाई गई सीट पंद्रह मिनट तक रखी जाती है। एक हाथ में एक खिलाड़ी।
      </Text>
    ),
  },
};
