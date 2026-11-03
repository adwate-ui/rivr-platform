import { Icon, type IconName } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

export interface RoundActionProps {
  icon: IconName;
  /** Under the circle: "Top up". */
  label: string;
  onPress: () => void;
  /** Its request is with the floor: dimmed to 40%, and a press does nothing. */
  isPending?: boolean;
}

/**
 * One of the seat's actions on Tonight (decision 0320): a 52 px circle with its icon, its name beneath. While its request
 * waits on the floor it dims and stays unpressable, and a screen reader hears it unavailable.
 */
export function RoundAction({ icon, label, onPress, isPending = false }: RoundActionProps) {
  return (
    <button type="button" aria-disabled={isPending || undefined} onClick={isPending ? undefined : onPress}
      className={cx('flex min-h-touch flex-col items-center gap-2 font-text text-13 leading-control text-content transition-opacity',
        isPending && 'cursor-not-allowed opacity-disabled')}>
      <span aria-hidden="true" className="flex size-round items-center justify-center rounded-full border border-control">
        <Icon name={icon} size="lg" />
      </span>
      {label}
    </button>
  );
}
