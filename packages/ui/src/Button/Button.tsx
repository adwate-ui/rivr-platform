import type { MouseEvent, ReactNode } from 'react';
import { Icon, type IconName } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { useIsInConsole } from '../internal/consoleFrame.ts';

/**
 * `primary` is the gold filled button: at most one per screen. `secondary` is outlined with a
 * hairline, `text` is a cream text button, `danger` is a red fill for destructive actions. The console (decision 0464)
 * fills rather than outlines: `subtle`, a faint cream fill, in place of `secondary`; `strong`, a cream fill, for the main
 * action of each item in a list, such as a request's Approve, where gold is kept for the screen's one primary action.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'subtle' | 'strong' | 'text' | 'danger';

/**
 * `tall`, 54 px, is the player app's one gold action of a step or sheet (decision 0320). The console's (decision 0464):
 * `compact`, 36 px at a desk, and `small`, 32 px at a desk for an action inside a row or tile; both keep the 44 px touch
 * target below 1180 px (decision 0282).
 */
export type ButtonSize = 'regular' | 'large' | 'tall' | 'compact' | 'small';

/** `pill` rounds the ends: the player app's small actions in a row, such as Add, Notify me or Redeem (decision 0320). */
export type ButtonShape = 'rounded' | 'pill';

interface ButtonLookProps {
  /** The label: a verb, sentence case. */
  children: ReactNode;
  variant?: ButtonVariant;
  /** A leading icon, only where it carries meaning a word cannot. */
  icon?: IconName;
  fullWidth?: boolean;
  /** `large`, 48 px tall, for the one action of a sign-in step; otherwise the 44 px touch height. */
  size?: ButtonSize;
  shape?: ButtonShape;
  /** A fuller name for a screen reader, where the label alone repeats: `Read: Bankroll basics`. It starts with the label. */
  'aria-label'?: string;
  'aria-describedby'?: string;
  /** For a button that opens something in place, such as a row's form (console v3): whether it is open now. */
  'aria-expanded'?: boolean;
}

interface ActionButtonProps extends ButtonLookProps {
  href?: undefined;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Shows a turning circle beside the label and ignores presses while an action is in flight. Focus stays put. */
  isLoading?: boolean;
  isDisabled?: boolean;
  /** Submits the form with this id from outside it. */
  form?: string;
  /** A toggle that is on, such as Notifying you: gold edge and text, and read out as pressed. */
  isPressed?: boolean | undefined;
  /**
   * A second part of the label at the button's right end, the label (and any icon or turning circle) at its left, not the
   * two together in its middle: the Order screen's "Send to the bar" and "2 items" (brief 3.5; owner, 3 Nov).
   */
  aside?: ReactNode;
  /** A gold dot before the label: a control for what needs the floor, such as the Live floor's Needs you (decision 0463). */
  hasDot?: boolean;
  /** A key that does the same on the screen (console v3, from `useShortcut`): its tooltip names it, and it is announced. */
  shortcut?: { readonly key: string; readonly hint: string } | undefined;
}

/** A link only goes somewhere: it is never loading, disabled or a form's submit. */
interface LinkButtonProps extends ButtonLookProps {
  /** Makes it a link to this address that looks the same: the website's hand-off to the player app. */
  href: string;
  /** Saves what the link points at as a file of this name instead of opening it: a report the console has made. */
  download?: string;
  /** Opens the link in a new tab, so the screen stays: the CCTV recorder's playback page. */
  opensNewTab?: boolean;
  type?: never;
  onClick?: never;
  isLoading?: never;
  isDisabled?: never;
  form?: never;
  isPressed?: never;
  aside?: never;
  hasDot?: never;
  shortcut?: never;
}

export type ButtonProps = ActionButtonProps | LinkButtonProps;

// The gold action is semibold, as in the prototype; the rest are medium.
const VARIANT: Record<ButtonVariant, string> = {
  // The edge is gold on gold, so unseen, until a cream band makes it ink (F-193).
  primary: 'bg-action font-semibold text-on-action inset-ring inset-ring-gold-edge',
  secondary: 'border border-hairline font-medium text-content hover:border-control',
  // The player redesign's outlined button: the control colour's edge (decision 0320).
  outline: 'border border-control font-medium text-content',
  subtle: 'bg-subtle font-medium text-content hover:bg-subtle-hover',
  strong: 'bg-cream font-semibold text-on-cream',
  text: 'font-medium text-content underline-offset-4 hover:underline',
  danger: 'bg-alert font-medium text-on-alert',
};

const SIZE: Record<ButtonSize, string> = {
  regular: 'min-h-touch', large: 'min-h-12', tall: 'min-h-action',
  compact: 'min-h-touch tablet:min-h-control', small: 'min-h-touch tablet:min-h-8',
};

// A text button sits close to its words; a pill is set smaller, as in the player redesign's prototype.
const SHAPE: Record<ButtonShape, string> = { rounded: 'rounded-lg text-16', pill: 'rounded-full text-14' };

// The console's sizes set their own corner and type, as in its prototype (decision 0464).
const CONSOLE_LOOK: Partial<Record<ButtonSize, string>> = { compact: 'rounded-md text-14 px-4', small: 'rounded-md text-13 px-3' };

const PADDING = (variant: ButtonVariant, shape: ButtonShape) => (variant === 'text' ? 'px-3' : shape === 'pill' ? 'px-4' : 'px-5');

/** A text button's only icon is the back chevron, 4 px from its word as in the player's prototype (F-176). */
const GAP = (variant: ButtonVariant) => (variant === 'text' ? 'gap-1' : 'gap-2');

/** The gap, corner, type size and padding: the console's sizes have their own; the rest follow the shape. */
const lookOf = (variant: ButtonVariant, size: ButtonSize, shape: ButtonShape) =>
  cx(GAP(variant), CONSOLE_LOOK[size] ?? cx(SHAPE[shape], PADDING(variant, shape)));

const PRESSED = 'border border-accent font-medium text-accent';

const BASE =
  // wrap-normal: a label breaks at a space, never inside a word, even in a table cell that lets text wrap anywhere.
  // leading-control: a whole-pixel line box, so the centred label starts on a pixel (#762).
  'inline-flex min-w-touch items-center font-text leading-control wrap-normal ' +
  'select-none transition-colors active:opacity-muted disabled:cursor-not-allowed disabled:opacity-disabled aria-busy:cursor-progress';

/** The link form of a button: it goes somewhere, saves a file, or opens a new tab. */
/** The look of a button that names none (audit F-125): on the console filled and 36 px at a desk; elsewhere outlined and 44 px. */
function useDefaults(variant: ButtonVariant | undefined, size: ButtonSize | undefined): { variant: ButtonVariant; size: ButtonSize } {
  const isBareOnConsole = useIsInConsole() && variant === undefined;
  return { variant: variant ?? (isBareOnConsole ? 'subtle' : 'secondary'), size: size ?? (isBareOnConsole ? 'compact' : 'regular') };
}

function LinkButton({ children, variant: namedVariant, size: namedSize, shape = 'rounded', icon, fullWidth, href, download, opensNewTab, ...rest }: LinkButtonProps) {
  const { variant, size } = useDefaults(namedVariant, namedSize);
  return (
    <a href={href} download={download} className={cx(BASE, 'justify-center', SIZE[size], VARIANT[variant], lookOf(variant, size, shape), fullWidth && 'w-full')}
      target={opensNewTab ? '_blank' : undefined} rel={opensNewTab ? 'noopener noreferrer' : undefined}
      aria-label={rest['aria-label']}
      aria-describedby={rest['aria-describedby']}>
      <ButtonLabel icon={icon} isLoading={false}>
        {children}
      </ButtonLabel>
    </a>
  );
}

/** A key that does the same as the button: its tooltip and the key a screen reader announces. */
const keyShortcut = (shortcut: ActionButtonProps['shortcut']) =>
  shortcut === undefined ? {} : { title: shortcut.hint, 'aria-keyshortcuts': shortcut.key };

/** A button with a 44 px minimum touch target; a link that looks like one when it has an `href`. */
export function Button(props: ButtonProps) {
  return props.href === undefined ? <ActionButton {...props} /> : <LinkButton {...props} />;
}

/** The label, after a gold dot when it has one. */
function withDot(children: ReactNode, hasDot: boolean | undefined): ReactNode {
  return hasDot === true ? <><span aria-hidden="true" className="size-pip shrink-0 rounded-full bg-action" />{children}</> : children;
}

function ActionButton({ children, variant: namedVariant, size: namedSize, shape = 'rounded', type = 'button', onClick, isLoading, isDisabled, isPressed, aside, icon, fullWidth, shortcut, hasDot, ...rest }: ActionButtonProps) {
  const { variant, size } = useDefaults(namedVariant, namedSize);
  const busy = isLoading ? true : undefined;
  const label = withDot(children, hasDot);
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isLoading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      type={type}
      className={cx(BASE, aside === undefined ? 'justify-center' : 'justify-between', SIZE[size], isPressed ? PRESSED : VARIANT[variant], lookOf(variant, size, shape), fullWidth && 'w-full')}
      onClick={handleClick}
      disabled={isDisabled}
      aria-pressed={isPressed}
      aria-busy={busy}
      aria-disabled={busy}
      {...keyShortcut(shortcut)}
      {...rest}
    >
      {aside === undefined ? (
        <ButtonLabel icon={icon} isLoading={isLoading}>{label}</ButtonLabel>
      ) : (
        // The label and its circle stay together at the left; the space between keeps the two parts apart in its name.
        <>
          <span className="inline-flex items-center gap-2"><ButtonLabel icon={icon} isLoading={isLoading}>{label}</ButtonLabel></span>
          {' '}
          <span>{aside}</span>
        </>
      )}
    </button>
  );
}

/**
 * The icon and label; while an action is in flight, a turning circle in the icon's place and the same label, at full
 * strength, so the button still says what it does and matches its name (F5-17). The circle turns by `data-busy-turn` in
 * styles.css, still under reduced motion; a screen reader hears the button unavailable (`aria-disabled`) while it is.
 */
function ButtonLabel({ icon, isLoading, children }: { icon: IconName | undefined; isLoading: boolean | undefined; children: ReactNode }) {
  if (isLoading) {
    return (
      <>
        <span className="inline-flex" data-busy-turn="" aria-hidden="true"><Icon name="loading" /></span>
        {children}
      </>
    );
  }
  return (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </>
  );
}
