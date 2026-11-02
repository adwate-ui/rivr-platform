import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline } from '../Inline/Inline.tsx';
import { ItemPhoto } from './ItemPhoto.tsx';

// A tile has no loading or error state of its own: until its photo loads, and if it never does, it shows the initial.
const meta = {
  title: 'Media/ItemPhoto',
  component: ItemPhoto,
  args: { src: '/media/chefs-menu.webp', name: 'Paneer tikka' },
} satisfies Meta<typeof ItemPhoto>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnTheMenu: Story = { args: { size: 'sm' } };

/** Empty: no photo yet, the initial in its place. */
export const NoPhotoYet: Story = { args: { src: null, name: 'Masala chai' } };

export const NotLoaded: Story = { args: { src: '/media/none.webp', name: 'RIVR hoodie' } };

export const Sizes: Story = {
  render: () => (
    <Inline gap={4} align="center">
      <ItemPhoto src="/media/chips.webp" name="Tournament seat" size="sm" />
      <ItemPhoto src="/media/chips.webp" name="Tournament seat" />
      <ItemPhoto src={null} name="Hotel night" size="sm" />
      <ItemPhoto src={null} name="Hotel night" />
    </Inline>
  ),
};

export const LongText: Story = { args: { src: null, name: '  weekend brunch for two at the partner hotel, with a late checkout' } };
