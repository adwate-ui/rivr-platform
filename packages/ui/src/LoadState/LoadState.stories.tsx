import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadState } from './LoadState.tsx';

const meta = { title: 'Feedback/LoadState', component: LoadState, args: {} } satisfies Meta<typeof LoadState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Still loading. */
export const Loading: Story = {};

/** It failed, with Retry. */
export const Error: Story = { args: { isError: true, onRetry: () => {} } };

/** A whole player screen that failed, as the prototype draws it: the serif line, what to do, and Try again (F-176). */
export const ErrorOnAPlayerScreen: Story = { tags: ['viewport-phone'], args: { isError: true, look: 'serif', onRetry: () => {} } };

/** It failed, saying why, with nothing to retry. */
export const ErrorWithText: Story = { args: { isError: true, errorText: 'The archive could not be read. Ask a super admin to check the key.' } };
