import { t } from '@rivr/i18n';
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import type { ShortcutHint } from '../Shortcuts/Shortcuts.tsx';

export interface AccountMenuProps {
  /** Who is signed in: the button shows their initials and names itself with it, and the menu opens on it. */
  name: string;
  /** Under the name: their role and the venue the console works in, "Super admin · RIVR Gurugram". */
  detail: string;
  /** The staff member's settings, each a row: an `AccountMenuRow` with a `Segmented`, a `Switch`. */
  children?: ReactNode;
  /** Under the settings, muted: the keys that work on this screen. */
  shortcuts?: readonly ShortcutHint[];
  /** The menu's last line. */
  signOut: { label: string; onPress: () => void; isPending?: boolean };
}

/** "Vikram Rao" is VR; a single name its first letter. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

const TRIGGER =
  'flex size-touch shrink-0 items-center justify-center rounded-full bg-raised font-text text-12 leading-tight font-semibold text-content ' +
  'transition-colors hover:bg-subtle-hover aria-expanded:bg-subtle-hover focus-visible:outline focus-visible:outline-focus tablet:size-control';

const PANEL = 'absolute end-0 top-full z-overlay mt-2 flex w-max min-w-rail max-w-side-panel flex-col gap-1 rounded-lg bg-raised p-2 shadow-modal focus:outline-none';

const SIGN_OUT =
  'flex min-h-touch w-full items-center rounded-md px-3 text-start font-text text-13 leading-control text-content transition-colors ' +
  'hover:bg-subtle focus-visible:outline focus-visible:outline-focus disabled:opacity-disabled tablet:min-h-control';

interface DisclosureRefs {
  readonly trigger: RefObject<HTMLButtonElement | null>;
  readonly panel: RefObject<HTMLDivElement | null>;
}

/** Open or shut, closing back to the button on Escape and on its own when the focus or a click goes elsewhere. */
function useDisclosure({ trigger, panel }: DisclosureRefs) {
  const [isOpen, setOpen] = useState(false);
  useEffect(() => {
    if (isOpen) panel.current?.focus();
  }, [isOpen, panel]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !isOpen) return;
    event.preventDefault();
    setOpen(false);
    trigger.current?.focus();
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };
  return { isOpen, toggle: () => setOpen((open) => !open), onKeyDown, onBlur };
}

/** The keys that work, each with what it does, small and muted. */
function ShortcutList({ shortcuts }: { shortcuts: readonly ShortcutHint[] }) {
  const headingId = useId();
  return (
    <div className="flex flex-col gap-1 px-3 py-2 font-text text-12 leading-snug text-content-muted">
      <p id={headingId}>{t('ui.console.account.shortcuts')}</p>
      <ul aria-labelledby={headingId} className="flex flex-col gap-1">
        {shortcuts.map((shortcut) => (
          <li key={shortcut.keys} className="flex items-center gap-2">
            <kbd className="min-w-6 rounded-sm bg-subtle px-1 text-center font-text text-12 text-content">{shortcut.keys}</kbd>
            <span>{shortcut.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The staff member's menu at the end of the console's header (console v3): a round button with their initials opens a
 * raised panel with their name, role and venue, their settings, the keyboard's shortcuts and Sign out. Escape closes it
 * back to the button; a click or the focus going elsewhere closes it too. 36 px at a desk, 44 px below 1180 px.
 */
export function AccountMenu({ name, detail, children, shortcuts = [], signOut }: AccountMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const menu = useDisclosure({ trigger, panel });
  const panelId = useId();
  const nameId = useId();
  return (
    <div className="relative flex" onKeyDown={menu.onKeyDown} onBlur={menu.onBlur}>
      {/* Named from the initials it shows first, then whose they are (WCAG 2.5.3): "AM, Aditya Malhotra". */}
      <button ref={trigger} type="button" title={name} aria-label={t('ui.console.account.button', { initials: initialsOf(name), name })} aria-expanded={menu.isOpen}
        aria-controls={menu.isOpen ? panelId : undefined} onClick={menu.toggle} className={TRIGGER}>
        <span aria-hidden="true">{initialsOf(name)}</span>
      </button>
      {menu.isOpen ? (
        <div ref={panel} id={panelId} role="group" aria-labelledby={nameId} tabIndex={-1} className={PANEL}>
          <div className="flex flex-col gap-1 px-3 pt-2 pb-3">
            <p id={nameId} className="font-text text-14 leading-snug font-semibold text-content">{name}</p>
            <p className="font-text text-12 leading-snug text-content-muted">{detail}</p>
          </div>
          {children ? <div className="flex flex-col px-3">{children}</div> : null}
          {shortcuts.length > 0 ? <ShortcutList shortcuts={shortcuts} /> : null}
          <button type="button" onClick={signOut.onPress} disabled={signOut.isPending} className={SIGN_OUT}>{signOut.label}</button>
        </div>
      ) : null}
    </div>
  );
}

/** One setting in the menu: its name at the left, its control at the right, on one centred line. */
export function AccountMenuRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-touch items-center justify-between gap-4 font-text text-13 leading-control text-content tablet:min-h-control">
      <span>{label}</span>
      {children}
    </div>
  );
}
