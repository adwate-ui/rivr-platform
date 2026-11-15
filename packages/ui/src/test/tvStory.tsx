import type { Decorator } from '@storybook/react-vite';
import { DisplayShell } from '../DisplayShell/DisplayShell.tsx';

/** The moment the TV stories' clock shows: 02:43 IST. */
export const TV_STORY_NOW = new Date('2026-11-15T21:13:00Z');

/** The club's notice along the foot of the TV stories. */
export const TV_STORY_NOTICE = 'Table 4 opens at 9 tonight: Pot-Limit Omaha 100/200. Ask the floor for a seat.';

/** A TV board's story on the TV's stage, with the clock and the notice as a board in the room has them. */
export const onTv: Decorator = (Story) => (
  <DisplayShell clockAt={TV_STORY_NOW} notice={TV_STORY_NOTICE}>
    <Story />
  </DisplayShell>
);
