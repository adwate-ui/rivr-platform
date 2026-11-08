import { tokens } from '@rivr/tokens';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProfileMark } from './ProfileMark.tsx';

// A plain portrait drawn in place, in the palette, taller than wide as a selfie is, so the screenshot never depends on a
// network image and shows the photo filling the circle with no empty sides.
const { greenBlack, cream } = tokens.color;
const PORTRAIT =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 40"><rect width="30" height="40" fill="${greenBlack}"/>` +
      `<circle cx="15" cy="17" r="7" fill="${cream}"/><rect x="5" y="27" width="20" height="13" rx="6" fill="${cream}"/></svg>`,
  );

// The mark shows what it is given; until a photo comes, the initial is its loading state.
const meta = {
  title: 'Data/ProfileMark',
  component: ProfileMark,
  args: { initial: 'I' },
} satisfies Meta<typeof ProfileMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPhoto: Story = { args: { photo: PORTRAIT } };
