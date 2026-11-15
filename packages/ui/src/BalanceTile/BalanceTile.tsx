import { t } from '@rivr/i18n';
import { Figure } from '../Figure/Figure.tsx';
import { Icon, type IconName } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

export interface BalanceTileProps {
  /** `chip` for bonus chips. */
  icon: IconName;
  /** The figure: `3,250`. */
  figure: string;
  /** What it is: `Bonus chips`. */
  label: string;
  /** What it is for, one line: `Used with a buy-in.` */
  line: string;
  /** `money` draws the icon and figure gold (bonus chips); `default` cream. */
  tone?: 'default' | 'money';
  /** Opens its history in place; with it the tile is a button that says History, with a chevron (F-054). */
  onOpen?: (() => void) | undefined;
  /** For a tile that opens its history in place: whether it is open now. */
  'aria-expanded'?: boolean;
}

/**
 * A balance of the member's at the top of Bonus (owner, 8 Nov): its icon and figure, what it is, and one line on what
 * it is for.
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
      {onOpen ? (
        <span className="flex items-center gap-1 font-text text-12 text-content-muted">
          {t('ui.balanceTile.history')}
          <Icon name={isExpanded === true ? 'chevronUp' : 'chevronDown'} size="sm" />
        </span>
      ) : null}
    </>
  );
  const tile = 'flex min-w-0 flex-1 flex-col items-start gap-1 rounded-md border border-hairline bg-raised p-4 text-start';
  if (!onOpen) return <div className={tile}>{body}</div>;
  return (
    <button type="button" className={cx(tile, 'min-h-touch focus-visible:outline focus-visible:outline-focus')} aria-expanded={isExpanded} onClick={onOpen}>
      {body}
    </button>
  );
}
