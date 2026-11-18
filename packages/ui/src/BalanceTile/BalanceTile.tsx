import { t } from '@rivr/i18n';
import { Figure } from '../Figure/Figure.tsx';
import { Icon, type IconName } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

export interface BalanceTileProps {
  /** `chip` for bonus chips. The `hero` look draws none. */
  icon?: IconName | undefined;
  /** The figure: `3,250`. */
  figure: string;
  /** What it is: `Bonus chips`. */
  label: string;
  /** What it is for, one line: `Used with a buy-in.` */
  line: string;
  /** `money` draws the icon and figure gold (bonus chips); `default` cream. */
  tone?: 'default' | 'money';
  /**
   * `tile`, the default: the icon and figure, its name under them, then the line. `hero`, the member's own balance at the
   * top of Bonus (redesign RD-20): its name small above, the figure large in the display face, the line beneath, in a
   * gold-edged card, with no icon and no history of its own.
   */
  look?: 'tile' | 'hero';
  /** Opens its history in place; with it the tile is a button that says History, with a chevron (F-054). */
  onOpen?: (() => void) | undefined;
  /** For a tile that opens its history in place: whether it is open now. */
  'aria-expanded'?: boolean;
}

/**
 * The hero's figure in the display face; one below zero keeps its sign in the text face (#1077), as the display face's minus
 * reads as a rule. Read as one figure: `−500`.
 */
function HeroFigure({ figure, tone }: { figure: string; tone: 'default' | 'money' }) {
  if (!figure.startsWith('−')) return <Figure size="display" tone={tone}>{figure}</Figure>;
  return (
    <span className="inline-flex items-baseline">
      <span className={cx('font-text text-56 leading-tight', tone === 'money' ? 'text-money' : 'text-content')}>−</span>
      <Figure size="display" tone={tone}>{figure.slice(1)}</Figure>
    </span>
  );
}

/** The member's own balance, large: the name, the figure, the line. */
function Hero({ figure, label, line, tone }: Pick<BalanceTileProps, 'figure' | 'label' | 'line'> & { tone: 'default' | 'money' }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2 rounded-card border border-gold-edge bg-raised p-5 text-start">
      <span className="font-text text-14 text-content-muted">{label}</span>
      <HeroFigure figure={figure} tone={tone} />
      <span className="font-text text-14 text-content-muted">{line}</span>
    </div>
  );
}

/**
 * A balance of the member's at the top of Bonus (owner, 8 Nov): its icon and figure, what it is, and one line on what
 * it is for.
 */
export function BalanceTile({ icon, figure, label, line, tone = 'default', look = 'tile', onOpen, 'aria-expanded': isExpanded }: BalanceTileProps) {
  if (look === 'hero') return <Hero figure={figure} label={label} line={line} tone={tone} />;
  const body = (
    <>
      <span className={cx('flex items-center gap-2', tone === 'money' ? 'text-accent' : 'text-content')}>
        {icon === undefined ? null : <Icon name={icon} size="sm" />}
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
