import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from '../Text/Text.tsx';
import { PrintSheet } from './PrintSheet.tsx';

// A print sheet shows nothing on the screen: this story's screenshot is the page around it, with the sheet left
// out. It has no loading, empty or error state.
const meta = {
  title: 'Paper/PrintSheet',
  component: PrintSheet,
  args: { children: <Text>On paper only.</Text> },
  decorators: [(Story) => <div><Text>On the screen, without the sheet.</Text><Story /></div>],
} satisfies Meta<typeof PrintSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
