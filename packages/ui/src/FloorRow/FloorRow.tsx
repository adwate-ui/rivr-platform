import type { ReactNode } from 'react';
import { Inline } from '../Inline/Inline.tsx';
import { Stakes } from '../Stakes/Stakes.tsx';
import { Text } from '../Text/Text.tsx';

export interface FloorRowProps {
  /** The table's name: "Table 3", "Private Room". */
  name: string;
  /** Small blind in paise. */
  smallBlind?: bigint | undefined;
  /** Big blind in paise. */
  bigBlind?: bigint | undefined;
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
    // Wraps: the name keeps 96 px, so an action that grows, as Leave asking to be sure does, goes under it rather than
    // squeezing it to a word (P-04).
    <Inline gap={4} align="center" justify="between" wrap>
      <div className="flex min-w-0 grow basis-24 flex-col gap-1">
        <Inline gap={3} align="baseline" wrap>
          <Text weight="medium" tone={tone}>{name}</Text>
          {smallBlind === undefined || bigBlind === undefined ? null : <Stakes smallBlind={smallBlind} bigBlind={bigBlind} tone="muted" />}
        </Inline>
        <Text variant="small" tone="muted">{detail}</Text>
      </div>
      {action ?? null}
    </Inline>
  );
}
