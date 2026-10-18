import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { KillSwitchBanner as Banner } from '../KillSwitchBanner/KillSwitchBanner.tsx';
import { Text } from '../Text/Text.tsx';
import { DriverShell } from './DriverShell.tsx';

const pickup = (name: string, place: string) => (
  <Stack gap={1}>
    <Text weight="medium">{name}</Text>
    <Text tone="muted">{place}</Text>
  </Stack>
);

const meta = {
  title: 'Shells/DriverShell',
  component: DriverShell,
  tags: ['viewport-phone'],
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Pickups',
    footer: (
      <Button variant="primary" fullWidth>
        Arrived
      </Button>
    ),
    children: pickup('Aarav M.', 'Sector 65 · 22:40'),
  },
} satisfies Meta<typeof DriverShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { footer: undefined, children: <Text tone="muted">No pickups yet.</Text> } };

export const WithBanner: Story = { args: { banner: <Banner audience="staff" /> } };

export const LongText: Story = {
  args: { children: pickup('Aarav M. and two guests', 'Tower B lobby, DLF The Crest, Sector 54, Golf Course Road · 22:40 · drop at RIVR') },
};

export const Hindi: Story = {
  globals: { locale: 'hi' },
  args: {
    title: 'पिकअप',
    footer: (
      <Button variant="primary" fullWidth>
        पहुँच गए
      </Button>
    ),
    children: pickup('आरव एम.', 'सेक्टर 65 · 22:40'),
  },
};
