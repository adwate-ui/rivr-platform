import { Text } from '../Text/Text.tsx';

export interface PromotionCardProps {
  /** The promotion, as published: "Double points". */
  title: string;
  /** What it gives, as published; absent when the title says it. */
  detail?: string | undefined;
  /** Who and when, in IST: "NLH 100/200 · Thursday, 14:00 to 20:00". */
  runs?: string | undefined;
}

/**
 * A promotion as the player app shows it (#84, #86): the title, what it gives and who and when, on a
 * raised card. The console's builder previews it; Home pages through the live ones.
 */
export function PromotionCard({ title, detail, runs }: PromotionCardProps) {
  return (
    <article aria-label={title} className="flex flex-col gap-2 rounded-md bg-raised px-6 py-5">
      <p className="font-text text-18 font-medium leading-snug text-content">{title}</p>
      {detail === undefined ? null : <Text>{detail}</Text>}
      {runs === undefined ? null : <Text variant="small" tone="muted">{runs}</Text>}
    </article>
  );
}
