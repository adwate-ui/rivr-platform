import type { ReactNode } from 'react';
import { Inline } from '../Inline/Inline.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Stakes } from '../Stakes/Stakes.tsx';
import { Text } from '../Text/Text.tsx';

export interface FloorRowProps {
  /** The table's name: "Table 3", "Private Room". */
  name: string;
  /** Small blind in paise. */
  smallBlind: bigint;
  /** Big blind in paise. */
  bigBlind: bigint;
  /** One line under the name: how many wait, or that the table is closed. */
  detail: string;
  /** The row's one action, such as Join. */
  action?: ReactNode;
  /** Dims the name, for a closed table. */
  isMuted?: boolean;
}

/** One table on tonight's floor: its name and stakes, a line on its waitlist, and one action (design prompt, "Home"). */
export function FloorRow({ name, smallBlind, bigBlind, detail, action, isMuted = false }: FloorRowProps) {
  const tone = isMuted ? 'muted' : 'default';
  return (
    <Inline gap={4} align="center" justify="between">
      <Stack gap={1} grow>
        <Inline gap={3} align="baseline" wrap>
          <Text weight="medium" tone={tone}>{name}</Text>
          <Stakes smallBlind={smallBlind} bigBlind={bigBlind} tone="muted" />
        </Inline>
        <Text variant="small" tone="muted">{detail}</Text>
      </Stack>
      {action ?? null}
    </Inline>
  );
}
