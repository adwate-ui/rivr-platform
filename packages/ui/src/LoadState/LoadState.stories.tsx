import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadState } from './LoadState.tsx';

const meta = { title: 'Feedback/LoadState', component: LoadState, args: {} } satisfies Meta<typeof LoadState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Still loading. */
export const Loading: Story = {};

/** It failed, with Retry. */
export const Error: Story = { args: { isError: true, onRetry: () => {} } };

/** It failed, saying why, with nothing to retry. */
export const ErrorWithText: Story = { args: { isError: true, errorText: 'The archive could not be read. Ask a super admin to check the key.' } };
