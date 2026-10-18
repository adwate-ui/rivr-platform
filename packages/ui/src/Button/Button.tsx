import { useT } from '@rivr/i18n';
import type { MouseEvent, ReactNode } from 'react';
import { Icon, type IconName } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

/**
 * `primary` is the gold filled button: at most one per screen. `secondary` is outlined with a
 * hairline, `text` is a cream text button, `danger` is a red fill for destructive actions.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

export interface ButtonProps {
  /** The label: a verb, sentence case. */
  children: ReactNode;
  variant?: ButtonVariant;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Shows the loading label and ignores presses while an action is in flight. Focus stays put. */
  isLoading?: boolean;
  isDisabled?: boolean;
  /** A leading icon, only where it carries meaning a word cannot. */
  icon?: IconName;
  fullWidth?: boolean;
  /** Submits the form with this id from outside it. */
  form?: string;
  'aria-describedby'?: string;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-action px-5 text-on-action',
  secondary: 'border border-hairline px-5 text-content hover:bg-raised',
  text: 'px-3 text-content underline-offset-4 hover:underline',
  danger: 'bg-alert px-5 text-on-alert',
};

const BASE =
  'inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-lg font-text text-16 leading-snug font-medium ' +
  'select-none transition-colors disabled:cursor-not-allowed disabled:opacity-disabled aria-busy:cursor-progress aria-busy:opacity-disabled';

/** A button with a 44 px minimum touch target. */
export function Button({ children, variant = 'secondary', type = 'button', onClick, isLoading, isDisabled, icon, fullWidth, ...rest }: ButtonProps) {
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
      className={cx(BASE, VARIANT[variant], fullWidth && 'w-full')}
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
  const t = useT();
  if (isLoading) return <>{t('common.loading')}</>;
  return (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </>
  );
}
