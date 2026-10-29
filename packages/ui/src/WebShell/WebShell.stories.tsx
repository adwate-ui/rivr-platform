import type { Meta, StoryObj } from '@storybook/react-vite';
import { Container } from '../Container/Container.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { WebShell } from './WebShell.tsx';

const hero = (title: string, body: string) => (
  <Container width="console" paddingX={6}>
    <Stack gap={4}>
      <Heading level={1} variant="display">
        {title}
      </Heading>
      <Text variant="lead" tone="muted">
        {body}
      </Text>
    </Stack>
  </Container>
);

const meta = {
  title: 'Shells/WebShell',
  component: WebShell,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    links: [
      { label: 'Tournaments', href: '#tournaments' },
      { label: 'Membership', href: '#membership' },
      { label: 'Visit', href: '#visit' },
    ],
    footer: <Text variant="small" tone="muted">Upper floor, Glaza, M3M 65th Avenue, Gurugram · 14:00 to 08:00</Text>,
    children: hero('Skill runs deep.', 'A members’ poker club in Gurugram. Five tables and the Private Room, every night from 14:00.'),
  },
} satisfies Meta<typeof WebShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** With the bar above the header (#616): the club's number, WhatsApp and socials, and the member app. */
export const WithTopBar: Story = {
  args: {
    topBar: {
      links: [
        { label: '+91 00000 00000', href: 'tel:+910000000000' }, { label: 'WhatsApp', href: 'https://wa.me/910000000000' },
        { label: 'Instagram', href: 'https://www.instagram.com/rivr.pokerclub/' }, { label: 'YouTube', href: 'https://www.youtube.com/@rivr.pokerclub' },
      ],
      app: { label: 'Member app', href: '#app' },
    },
    action: { label: 'Reserve a seat', href: 'https://wa.me/910000000000' },
  },
};

export const Empty: Story = { args: { links: [], footer: undefined, children: hero('Tournaments', 'No tournaments scheduled.') } };

export const LongText: Story = {
  args: {
    children: hero(
      'RIVR Sunday',
      'The weekly tournament runs every Sunday from 16:00 with re-entry until the end of level eight, a guaranteed prize pool and a seat for the top three in the monthly League final.',
    ),
  },
};
