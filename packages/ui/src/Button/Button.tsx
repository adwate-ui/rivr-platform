import type { MouseEvent, ReactNode } from 'react';
import { Icon, type IconName } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

/**
 * `primary` is the gold filled button: at most one per screen. `secondary` is outlined with a
 * hairline, `text` is a cream text button, `danger` is a red fill for destructive actions.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger';

/** `tall`, 54 px, is the player app's one gold action of a step or sheet (decision 0320). */
export type ButtonSize = 'regular' | 'large' | 'tall';

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
}

export type ButtonProps = ActionButtonProps | LinkButtonProps;

// The gold action is semibold, as in the prototype; the rest are medium.
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-action font-semibold text-on-action',
  secondary: 'border border-hairline font-medium text-content hover:border-control',
  // The player redesign's outlined button: the control colour's edge (decision 0320).
  outline: 'border border-control font-medium text-content',
  text: 'font-medium text-content underline-offset-4 hover:underline',
  danger: 'bg-alert font-medium text-on-alert',
};

const SIZE: Record<ButtonSize, string> = { regular: 'min-h-touch', large: 'min-h-12', tall: 'min-h-action' };

// A text button sits close to its words; a pill is set smaller, as in the player redesign's prototype.
const SHAPE: Record<ButtonShape, string> = { rounded: 'rounded-lg text-16', pill: 'rounded-full text-14' };

const PADDING = (variant: ButtonVariant, shape: ButtonShape) => (variant === 'text' ? 'px-3' : shape === 'pill' ? 'px-4' : 'px-5');

const PRESSED = 'border border-accent font-medium text-accent';

const BASE =
  // wrap-normal: a label breaks at a space, never inside a word, even in a table cell that lets text wrap anywhere.
  'inline-flex min-w-touch items-center justify-center gap-2 font-text leading-snug wrap-normal ' +
  'select-none transition-colors active:opacity-muted disabled:cursor-not-allowed disabled:opacity-disabled aria-busy:cursor-progress';

/** The link form of a button: it goes somewhere, saves a file, or opens a new tab. */
function LinkButton({ children, variant = 'secondary', size = 'regular', shape = 'rounded', icon, fullWidth, href, download, opensNewTab, ...rest }: LinkButtonProps) {
  return (
    <a href={href} download={download} className={cx(BASE, SIZE[size], VARIANT[variant], SHAPE[shape], PADDING(variant, shape), fullWidth && 'w-full')}
      target={opensNewTab ? '_blank' : undefined} rel={opensNewTab ? 'noopener noreferrer' : undefined}
      aria-label={rest['aria-label']}
      aria-describedby={rest['aria-describedby']}>
      <ButtonLabel icon={icon} isLoading={false}>
        {children}
      </ButtonLabel>
    </a>
  );
}

/** A button with a 44 px minimum touch target; a link that looks like one when it has an `href`. */
export function Button(props: ButtonProps) {
  return props.href === undefined ? <ActionButton {...props} /> : <LinkButton {...props} />;
}

function ActionButton({ children, variant = 'secondary', size = 'regular', shape = 'rounded', type = 'button', onClick, isLoading, isDisabled, isPressed, icon, fullWidth, ...rest }: ActionButtonProps) {
  const busy = isLoading ? true : undefined;
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
      className={cx(BASE, SIZE[size], isPressed ? PRESSED : VARIANT[variant], SHAPE[shape], PADDING(variant, shape), fullWidth && 'w-full')}
      onClick={handleClick}
      disabled={isDisabled}
      aria-pressed={isPressed}
      aria-busy={busy}
      aria-disabled={busy}
      {...rest}
    >
      <ButtonLabel icon={icon} isLoading={isLoading}>
        {children}
      </ButtonLabel>
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
