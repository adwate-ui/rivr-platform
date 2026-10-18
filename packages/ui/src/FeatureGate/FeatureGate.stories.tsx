import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { Button } from '../Button/Button.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { FeatureGate } from './FeatureGate.tsx';

const referral = (
  <Box surface="raised" padding={4} radius="lg">
    <Stack gap={3}>
      <Text>Referral code RIVR-ADW-24</Text>
      <Button>Share</Button>
    </Stack>
  </Box>
);

const meta = {
  title: 'Features/FeatureGate',
  component: FeatureGate,
  args: { access: { state: 'enabled' }, children: referral },
} satisfies Meta<typeof FeatureGate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Enabled: Story = {};

export const Locked: Story = { args: { access: { state: 'locked', tiers: ['Founders’ Circle', 'Black card'] } } };

/** A hidden feature renders nothing at all. */
export const Hidden: Story = { args: { access: { state: 'hidden' } } };

export const LongText: Story = {
  args: { access: { state: 'locked', tiers: ['Academy graduate', 'Founders’ Circle', 'Black card', 'Private Room regulars'] } },
};
