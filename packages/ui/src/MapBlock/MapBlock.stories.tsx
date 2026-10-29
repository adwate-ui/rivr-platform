import type { Meta, StoryObj } from '@storybook/react-vite';
import { MapBlock } from './MapBlock.tsx';

const meta = {
  title: 'Website/MapBlock',
  component: MapBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    heading: 'Find us',
    address: 'Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram',
    hours: 'Open 14:00 to 08:00.',
    directionsUrl: 'https://www.google.com/maps/search/?api=1&query=Glaza%2C%20M3M%2065th%20Avenue%2C%20Gurugram',
  },
} satisfies Meta<typeof MapBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutHours: Story = { args: { heading: undefined, hours: undefined } };

export const LongText: Story = {
  args: {
    address: 'Upper floor, Glaza, M3M 65th Avenue, Golf Course Extension Road, Sector 65, Gurugram, Haryana 122101',
    hours: 'Open 14:00 to 08:00. The front desk closes for new check-ins at 06:00.',
  },
};

/** With the club's number and email (decision 0166). */
export const WithContact: Story = { args: { phone: '+919000000000', email: 'info@rivrpoker.com' } };

/** With a map to embed (#616), before the visitor allows maps: the note and its button in the map's place. */
export const WithMap: Story = { args: { embedUrl: 'https://www.google.com/maps?q=Glaza%2C%20Gurugram&output=embed' } };
