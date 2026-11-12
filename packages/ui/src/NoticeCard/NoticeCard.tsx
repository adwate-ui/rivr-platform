import { Icon } from '../Icon/Icon.tsx';
import { NoticeText } from '../NoticeText/NoticeText.tsx';
import { cx } from '../internal/classes.ts';

export interface NoticeCardProps {
  /** Its eyebrow, such as "From the club"; it names the card for a screen reader too. */
  label: string;
  /** The notice as staff wrote it, drawn by NoticeText. */
  text: string;
  /**
   * `club`, the default, a notice staff write: a gold eyebrow and edge. `alert`, the member's own ID check: a slight red
   * tinge, so it reads apart from the club's notices (the owner, 12 Nov).
   */
  tone?: 'club' | 'alert';
}

const LOOK = {
  club: { card: 'border-gold-edge bg-raised', eyebrow: 'text-accent' },
  alert: { card: 'border-red-edge bg-red-tint', eyebrow: 'text-danger' },
} as const;

/**
 * A club notice on Tonight (decision 0424): a raised card under the urgent banners and above the offers, with an eyebrow
 * and the notice in full. It stays while the notice runs: there is no dismiss. An article, not a landmark, so two cards
 * of the same name sit side by side for a screen reader.
 */
export function NoticeCard({ label, text, tone = 'club' }: NoticeCardProps) {
  const look = LOOK[tone];
  return (
    <article aria-label={label} className={cx('flex flex-col gap-2 rounded-lg border px-4 py-3 text-content', look.card)}>
      <span className={cx('flex items-center gap-2', look.eyebrow)}>
        <Icon name="info" size="sm" />
        <span className="font-text text-12 leading-snug font-medium tracking-wide uppercase">{label}</span>
      </span>
      <NoticeText text={text} />
    </article>
  );
}
