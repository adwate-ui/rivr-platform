import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline } from '../Inline/Inline.tsx';
import { BRAND_ICON_NAMES, BrandIcon } from './BrandIcon.tsx';

// A mark has no loading, empty or error state.
const meta = {
  title: 'Type/BrandIcon',
  component: BrandIcon,
  args: { name: 'whatsapp' },
} satisfies Meta<typeof BrandIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllMarks: Story = {
  render: () => (
    <Inline gap={4}>
      {BRAND_ICON_NAMES.map((name) => <BrandIcon key={name} name={name} size="lg" label={name} />)}
    </Inline>
  ),
};
