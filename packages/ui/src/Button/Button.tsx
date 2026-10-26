import { t } from '@rivr/i18n';
import type { MouseEvent, ReactNode } from 'react';
import { Icon, type IconName } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

/**
 * `primary` is the gold filled button: at most one per screen. `secondary` is outlined with a
 * hairline, `text` is a cream text button, `danger` is a red fill for destructive actions.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

export type ButtonSize = 'regular' | 'large';

interface ButtonLookProps {
  /** The label: a verb, sentence case. */
  children: ReactNode;
  variant?: ButtonVariant;
  /** A leading icon, only where it carries meaning a word cannot. */
  icon?: IconName;
  fullWidth?: boolean;
  /** `large`, 48 px tall, for the one action of a sign-in step; otherwise the 44 px touch height. */
  size?: ButtonSize;
  /** A fuller name for a screen reader, where the label alone repeats: `Read: Bankroll basics`. It starts with the label. */
  'aria-label'?: string;
  'aria-describedby'?: string;
}

interface ActionButtonProps extends ButtonLookProps {
  href?: undefined;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Shows the loading label and ignores presses while an action is in flight. Focus stays put. */
  isLoading?: boolean;
  isDisabled?: boolean;
  /** Submits the form with this id from outside it. */
  form?: string;
}

/** A link only goes somewhere: it is never loading, disabled or a form's submit. */
interface LinkButtonProps extends ButtonLookProps {
  /** Makes it a link to this address that looks the same: the website's hand-off to the player app. */
  href: string;
  type?: never;
  onClick?: never;
  isLoading?: never;
  isDisabled?: never;
  form?: never;
}

export type ButtonProps = ActionButtonProps | LinkButtonProps;

// The gold action is semibold, as in the prototype; the rest are medium.
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-action px-5 font-semibold text-on-action',
  secondary: 'border border-hairline px-5 font-medium text-content hover:bg-raised',
  text: 'px-3 font-medium text-content underline-offset-4 hover:underline',
  danger: 'bg-alert px-5 font-medium text-on-alert',
};

const SIZE: Record<ButtonSize, string> = { regular: 'min-h-touch', large: 'min-h-12' };

const BASE =
  'inline-flex min-w-touch items-center justify-center gap-2 rounded-lg font-text text-16 leading-snug ' +
  'select-none transition-colors disabled:cursor-not-allowed disabled:opacity-disabled aria-busy:cursor-progress aria-busy:opacity-disabled';

/** A button with a 44 px minimum touch target; a link that looks like one when it has an `href`. */
export function Button({ children, variant = 'secondary', size = 'regular', type = 'button', onClick, isLoading, isDisabled, icon, fullWidth, href, ...rest }: ButtonProps) {
  if (href !== undefined) {
    return (
      <a href={href} className={cx(BASE, SIZE[size], VARIANT[variant], fullWidth && 'w-full')} aria-label={rest['aria-label']}
        aria-describedby={rest['aria-describedby']}>
        <ButtonLabel icon={icon} isLoading={false}>
          {children}
        </ButtonLabel>
      </a>
    );
  }
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
      className={cx(BASE, SIZE[size], VARIANT[variant], fullWidth && 'w-full')}
      onClick={handleClick}
      disabled={isDisabled}
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

/** The icon and label, or the loading label while an action is in flight. */
function ButtonLabel({ icon, isLoading, children }: { icon: IconName | undefined; isLoading: boolean | undefined; children: ReactNode }) {
  if (isLoading) return <>{t('common.loading')}</>;
  return (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </>
  );
}
