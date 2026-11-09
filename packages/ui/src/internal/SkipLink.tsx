import { t } from '@rivr/i18n';

/** The id of a shell's main: Skip to content takes the focus there. */
export const MAIN_ID = 'rivr-main';

/**
 * A shell's first stop for a keyboard: Skip to content, seen only while it has the focus, which takes the focus past the
 * rail or the bars to the screen (F5-03).
 */
export function SkipLink() {
  return (
    <a href={`#${MAIN_ID}`}
      className="sr-only rounded-md bg-raised font-text text-16 text-content focus:not-sr-only focus:px-4 focus:py-2 focus:fixed focus:top-4 focus:left-4 focus:z-modal focus-visible:outline focus-visible:outline-focus"
      onClick={(event) => {
        event.preventDefault();
        document.getElementById(MAIN_ID)?.focus();
      }}>
      {t('ui.skipToContent')}
    </a>
  );
}
