import { Icon } from '../Icon/Icon.tsx';

/** A step finished (decision 0320): a gold 56 px circle with a tick, above "You're verified." Not read out: the title says it. */
export function DoneMark() {
  return (
    <span aria-hidden="true" className="flex size-tile items-center justify-center rounded-full bg-gold text-on-action">
      <Icon name="check" size="lg" />
    </span>
  );
}
