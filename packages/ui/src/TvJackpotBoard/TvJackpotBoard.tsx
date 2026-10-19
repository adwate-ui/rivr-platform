import { Heading } from '../Heading/Heading.tsx';
import { Money } from '../Money/Money.tsx';
import { Text } from '../Text/Text.tsx';

export interface TvJackpotBoardProps {
  /** The letter-spaced label above the figure: "Bad-beat jackpot". */
  label: string;
  /** The main pool, in paise. */
  amount: bigint;
  /** The label above tonight's high hand: "High hand tonight". */
  highHandLabel: string;
  /** Tonight's best high hand: what it is ("Four of a kind, Queens") and where, when and what it paid. Null before one is paid. */
  highHand: { title: string; line: string } | null;
  /** What shows when there is none yet: "No high hand yet tonight." */
  noHighHandText: string;
}

/**
 * The TV's jackpot (#65), as in the prototype: the bad-beat figure large in the display face, and
 * tonight's high hand beneath it. It holds no state: the TV app passes what to show.
 */
export function TvJackpotBoard({ label, amount, highHandLabel, highHand, noHighHandText }: TvJackpotBoardProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <Text variant="tvLabel" tone="muted" align="center">{label}</Text>
      <Money paise={amount} size="tvJackpot" />
      <hr className="mt-14 mb-12 w-2/5 border-hairline" />
      <Text variant="tvLabel" tone="muted" align="center">{highHandLabel}</Text>
      {highHand === null ? (
        <div className="pt-6"><Text variant="tvBody" tone="muted" align="center">{noHighHandText}</Text></div>
      ) : (
        <div className="flex flex-col items-center gap-3 pt-4">
          <Heading level={2} variant="tvTitle" align="center">{highHand.title}</Heading>
          <Text variant="tvBody" align="center">{highHand.line}</Text>
        </div>
      )}
    </div>
  );
}
