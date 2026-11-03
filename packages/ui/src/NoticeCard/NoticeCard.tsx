import { Icon } from '../Icon/Icon.tsx';
import { NoticeText } from '../NoticeText/NoticeText.tsx';

export interface NoticeCardProps {
  /** Its gold eyebrow, such as "From the club"; it names the card for a screen reader too. */
  label: string;
  /** The notice as staff wrote it, drawn by NoticeText. */
  text: string;
}

/**
 * A club notice on Tonight (decision 0424): a raised card under the urgent banners and above the offers, with a gold eyebrow
 * and the notice in full. It stays while the notice runs: there is no dismiss. An article, not a landmark, so two cards
 * of the same name sit side by side for a screen reader.
 */
export function NoticeCard({ label, text }: NoticeCardProps) {
  return (
    <article aria-label={label} className="flex flex-col gap-2 rounded-lg border border-gold-edge bg-raised px-4 py-3 text-content">
      <span className="flex items-center gap-2 text-accent">
        <Icon name="info" size="sm" />
        <span className="font-text text-12 leading-snug font-medium tracking-wide uppercase">{label}</span>
      </span>
      <NoticeText text={text} />
    </article>
  );
}
