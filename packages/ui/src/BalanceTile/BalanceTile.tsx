import { Figure } from '../Figure/Figure.tsx';
import { Icon, type IconName } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

export interface BalanceTileProps {
  /** `star` for points, `chip` for bonus chips. */
  icon: IconName;
  /** The figure: `3,250`. */
  figure: string;
  /** What it is: `Points`, `Bonus chips`. */
  label: string;
  /** What it is for, one line: `Spend on rewards.` */
  line: string;
  /** `money` draws the icon and figure gold (bonus chips); `default` cream (points). */
  tone?: 'default' | 'money';
  /** Opens its history in place; with it the tile is a button. */
  onOpen?: (() => void) | undefined;
  /** For a tile that opens its history in place: whether it is open now. */
  'aria-expanded'?: boolean;
}

/**
 * One of the member's balances at the top of Rewards (owner, 8 Nov: points and bonus chips told apart at a glance): its
 * icon and figure, what it is, and one line on what it is for. Two sit side by side.
 */
export function BalanceTile({ icon, figure, label, line, tone = 'default', onOpen, 'aria-expanded': isExpanded }: BalanceTileProps) {
  const body = (
    <>
      <span className={cx('flex items-center gap-2', tone === 'money' ? 'text-accent' : 'text-content')}>
        <Icon name={icon} size="sm" />
        <Figure size="title" tone={tone}>{figure}</Figure>
      </span>
      <span className="font-text text-14 font-medium text-content">{label}</span>
      <span className="font-text text-12 text-content-muted">{line}</span>
    </>
  );
  const tile = 'flex min-w-0 flex-1 flex-col items-start gap-1 rounded-md border border-hairline bg-raised p-4 text-start';
  if (!onOpen) return <div className={tile}>{body}</div>;
  return (
    <button type="button" className={cx(tile, 'min-h-touch focus-visible:outline-2 focus-visible:outline-focus')} aria-expanded={isExpanded} onClick={onOpen}>
      {body}
    </button>
  );
}
