import { t } from '@rivr/i18n';

export interface PracticeBannerProps {
  /** One line: what the practice venue is. */
  message: string;
  /** The way back: "Back to the club". */
  action: { label: string; onPress: () => void; isPending?: boolean };
}

const ACTION =
  'inline-flex min-h-touch shrink-0 items-center rounded-sm bg-raised px-3 font-text text-12 leading-control font-medium whitespace-nowrap text-content ' +
  'transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-disabled tablet:min-h-7';

/**
 * Across the top of the console while it works in the practice venue (console v3, decision 0444): gold stripes, the line
 * that nothing here reaches the club, and the way back to it. Its words and button sit centred on one line; on a phone
 * the words wrap beside the button. Not a `Banner` tone: that is a player's card inside a screen, rounded and edged; this
 * runs the full width of the console above everything, and is the only striped surface.
 */
export function PracticeBanner({ message, action }: PracticeBannerProps) {
  return (
    <section aria-label={t('ui.console.practice.label')} data-practice-stripes=""
      className="flex shrink-0 items-center justify-between gap-3 px-4 py-1 text-on-action">
      <p className="min-w-0 font-text text-13 leading-snug font-semibold">{message}</p>
      <button type="button" onClick={action.onPress} disabled={action.isPending} className={ACTION}>{action.label}</button>
    </section>
  );
}
