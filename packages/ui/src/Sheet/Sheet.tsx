import * as Dialog from '@radix-ui/react-dialog';
import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { ConsoleSheet } from './ConsoleSheet.tsx';

/** `display`, the title in the display face, for an action's sheet; `plain`, a list's, in the text face. */
export type SheetTitleLook = 'display' | 'plain';

export interface SheetProps {
  isOpen: boolean;
  /** Close, the scrim, Escape, or a sheet's own Cancel. */
  onClose: () => void;
  /** Names the sheet: "Add time". */
  title: string;
  /** A gold line above the title: the table's name, "Redeem". */
  eyebrow?: string | undefined;
  titleLook?: SheetTitleLook;
  /** A muted word at the title's right: "Choose one". */
  aside?: string | undefined;
  /**
   * `console`, the console's form (console v3): a 440 px panel down the right from 768 px and a sheet from the foot below,
   * with Close, `subtitle` and a `footer` that stay while the content scrolls. `player`, the player app's bottom sheet.
   */
  place?: 'player' | 'console';
  /** The console's form: a muted line under the title. */
  subtitle?: string | undefined;
  /** The console's form: its actions along the foot, Cancel and then the one action. */
  footer?: ReactNode;
  children: ReactNode;
}

const TITLE: Record<SheetTitleLook, string> = {
  display: 'font-display text-32 leading-tight font-regular',
  plain: 'font-text text-20 leading-snug font-medium',
};

// A 44 px target on the title's line, its room beyond the line taken back by its margins, as the console sheet's Close.
const CLOSE =
  'flex size-touch shrink-0 items-center justify-center rounded-md text-content transition-colors hover:bg-subtle ' +
  '-my-2 -mr-2 focus-visible:outline focus-visible:outline-focus';

/** A sheet over the screen: the player app's (decision 0320), or the console's with `place="console"` (console v3). */
export function Sheet(props: SheetProps) {
  if (props.place === 'console') return <ConsoleSheet {...props} />;
  return <PlayerSheet {...props} />;
}

/**
 * The player app's bottom sheet (decision 0320): a scrim that closes it when tapped, then a raised panel that slides up, its
 * title with Close at its end, and its content, scrolling inside past 720 px. Focus stays in it until it closes, and Escape
 * closes it. Close is for those who cannot press Escape or reach the scrim, as with VoiceOver or TalkBack; the sheet has no
 * grabber, as it does not drag (8 Nov audit, F-060).
 */
function PlayerSheet({ isOpen, onClose, title, eyebrow, titleLook = 'display', aside, children }: SheetProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay data-scrim="" className="fixed inset-0 z-overlay bg-scrim" />
        {/* Focus moves to the sheet itself, not its first button, so nothing looks pressed as it opens. */}
        <Dialog.Content aria-describedby={undefined} data-sheet=""
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
          }}
          className="fixed inset-x-0 bottom-0 z-modal mx-auto flex max-h-sheet flex-col gap-5 overflow-y-auto rounded-t-sheet border-t border-hairline bg-raised px-5 pt-5 pb-8 text-content shadow-modal focus:outline-none medium:max-w-phone">
          <div className="flex flex-col gap-1">
            {eyebrow ? <span className="font-text text-12 leading-snug font-medium tracking-wide text-accent uppercase">{eyebrow}</span> : null}
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                <Dialog.Title className={TITLE[titleLook]}>{title}</Dialog.Title>
                {aside ? <span className="font-text text-13 text-content-muted">{aside}</span> : null}
              </div>
              <Dialog.Close aria-label={t('ui.sheet.close')} className={CLOSE}><Icon name="close" /></Dialog.Close>
            </div>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
