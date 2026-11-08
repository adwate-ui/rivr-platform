import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabletShell } from '../TabletShell/TabletShell.tsx';
import { QrScanView } from './QrScanView.tsx';

const meta = {
  title: 'Tablet/QrScanView',
  component: QrScanView,
  tags: ['viewport-tablet'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <TabletShell tableName="Front door"><Story /></TabletShell>],
  args: { videoRef: null, prompt: 'Hold your RIVR card up to the camera', help: 'Open RIVR › Card, brightness up. Hold it here.', scannerLabel: 'Card scanner', retryCameraLabel: 'Retry camera', onRetryCamera: () => undefined, onScannerCode: () => undefined },
} satisfies Meta<typeof QrScanView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Waiting for a card. */
export const Default: Story = {};

export const CheckedIn: Story = { args: { result: { title: 'Welcome, Kavya.', detail: 'You are checked in. Enjoy the game.', isRefused: false } } };

export const CheckedOut: Story = {
  args: { result: { title: 'Goodbye, Mihir.', detail: '4 h 30 min at the tables tonight. See you soon.', isRefused: false } },
};

export const Refused: Story = {
  args: { result: { title: 'Not yet.', detail: '25 min of call time left. See the floor.', isRefused: true } },
};

/** A long name with nowhere to break, on the red-edged panel. */
export const RefusedLongName: Story = {
  args: { result: { title: 'Not yet, Venkataraghavankrishnamurthy.', detail: '25 min of call time left. See the floor.', isRefused: true } },
};

export const NoCamera: Story = { args: { cameraError: 'Camera unavailable. See the front desk.' } };

export const LongText: Story = {
  args: {
    result: { title: 'Welcome, Venkataraghavan.', detail: 'You are checked in. Enjoy the game, and ask the floor for a seat at your stake.', isRefused: false },
  },
};
