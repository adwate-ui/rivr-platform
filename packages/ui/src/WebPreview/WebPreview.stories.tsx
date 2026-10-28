import type { Meta, StoryObj } from '@storybook/react-vite';
import { WebPreview } from './WebPreview.tsx';

// A page of the website in the console's editor. The frame's page is the website's; a story shows a still one.
const meta = {
  title: 'Website/WebPreview',
  component: WebPreview,
  decorators: [(Story) => <div className="w-96 bg-surface p-4"><Story /></div>],
  args: {
    label: 'Preview of House rules',
    src: 'data:text/html,%3Ch1%3EHouse%20rules%3C%2Fh1%3E',
    emptyText: 'Save a draft to preview it.',
  },
} satisfies Meta<typeof WebPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Before the first draft is saved there is nothing to show. */
export const Empty: Story = { args: { src: null } };
