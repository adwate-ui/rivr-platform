import type { Meta, StoryObj } from '@storybook/react-vite';
import { Grid } from '../Grid/Grid.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { ICON_NAMES, Icon } from './Icon.tsx';

const meta = {
  title: 'Type/Icon',
  component: Icon,
  args: { name: 'home' },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllIcons: Story = {
  render: () => (
    <Grid columns={5} gap={4}>
      {ICON_NAMES.map((name) => (
        <Stack key={name} gap={1} align="center">
          <Icon name={name} size="lg" />
          <Text variant="caption" tone="muted">
            {name}
          </Text>
        </Stack>
      ))}
    </Grid>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Inline gap={4}>
      <Icon name="lock" size="sm" />
      <Icon name="lock" size="md" />
      <Icon name="lock" size="lg" />
      <Icon name="lock" size="xl" />
    </Inline>
  ),
};

export const Hindi: Story = {
  globals: { locale: 'hi' },
  render: () => (
    <Inline gap={2}>
      <Icon name="offline" label="ऑफ़लाइन" />
      <Text>ऑफ़लाइन।</Text>
    </Inline>
  ),
};
