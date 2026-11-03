import { t } from '@rivr/i18n';
import { Icon } from '../Icon/Icon.tsx';

export interface SearchTriggerProps {
  /** Opens the command palette. */
  onOpen: () => void;
}

const TRIGGER =
  'flex min-h-touch min-w-touch items-center justify-center gap-3 rounded-md font-text text-14 leading-control text-content transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-focus tablet:min-h-control ' +
  'medium:w-full medium:justify-start medium:bg-raised medium:px-3 medium:text-content-muted medium:hover:text-content';

/**
 * The console header's search (console v3): from 768 px a field-like button, "Search members, screens, actions" with its
 * `/` key; below, a search button. Either opens the command palette. Its fill is the rail's green-black, not cream at 5%,
 * so its muted words keep 4.5:1 (decision 0428).
 */
export function SearchTrigger({ onOpen }: SearchTriggerProps) {
  return (
    <button type="button" onClick={onOpen} aria-keyshortcuts="/ Control+K Meta+K" className={TRIGGER}>
      <span className="flex medium:hidden"><Icon name="search" /></span>
      <span className="hidden medium:flex"><Icon name="search" size="sm" /></span>
      <span className="sr-only medium:not-sr-only medium:min-w-0 medium:flex-1 medium:truncate medium:text-start">{t('ui.console.palette.trigger')}</span>
      <span aria-hidden="true" className="hidden text-12 medium:block">{t('ui.console.palette.key')}</span>
    </button>
  );
}
