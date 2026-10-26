import { tokens } from '@rivr/tokens';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { VenueLogo } from './VenueLogo.tsx';

// A plain wide mark drawn in place, in the palette, so the screenshot never depends on a network image.
const { greenBlack, cream } = tokens.color;
const LOGO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20"><rect width="60" height="20" rx="4" fill="${greenBlack}"/>` +
      `<circle cx="10" cy="10" r="5" fill="${cream}"/><rect x="20" y="7" width="34" height="6" rx="3" fill="${cream}"/></svg>`,
  );

const meta = {
  title: 'Media/VenueLogo',
  component: VenueLogo,
  args: { alt: 'The venue’s logo', src: LOGO },
} satisfies Meta<typeof VenueLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Missing: Story = { args: { src: null } };

export const WithError: Story = { args: { src: 'data:image/png;base64,bm90IGFuIGltYWdl' } };
