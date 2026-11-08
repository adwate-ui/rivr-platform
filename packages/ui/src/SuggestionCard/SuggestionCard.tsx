export interface SuggestionCardProps {
  /** The eyebrow, in cream on the tint (F-200): "Your usual". */
  title: string;
  /** What it suggests: "Masala chai, Club sandwich". */
  text: string;
  /** The pill at its right: "Add both". */
  actionLabel: string;
  onPress: () => void;
}

/**
 * A suggestion picked out at the top of a list (decision 0320): on the Order screen, the member's usual, gold-edged on a gold
 * tint, the whole card a button with its gold pill.
 */
export function SuggestionCard({ title, text, actionLabel, onPress }: SuggestionCardProps) {
  return (
    <button type="button" onClick={onPress}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-gold bg-gold-tint px-4 py-3 text-start text-content">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-text text-12 leading-snug font-medium tracking-wide text-content uppercase">{title}</span>
        <span className="font-text text-16">{text}</span>
      </span>
      <span className="flex min-h-touch shrink-0 items-center rounded-full bg-action px-4 font-text text-14 font-semibold text-on-action">{actionLabel}</span>
    </button>
  );
}
