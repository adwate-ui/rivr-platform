import * as Dialog from '@radix-ui/react-dialog';
import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon.tsx';

export interface ConsoleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** A muted line under the title: "Table 2, seat 5 · Black card". */
  subtitle?: string | undefined;
  /** The actions along the foot, which stay in view: Cancel, then the one action. */
  footer?: ReactNode;
  children: ReactNode;
}

const CLOSE =
  'flex size-touch shrink-0 items-center justify-center rounded-md text-content transition-colors hover:bg-subtle ' +
  '-my-2 -mr-2 focus-visible:outline focus-visible:outline-focus tablet:size-control';

/**
 * The console's sheet (console v3): from 768 px a panel 440 px wide down the right of the screen; below, a sheet from the
 * foot to just under the top. Its title and its actions stay while its content scrolls between them. Escape, Close and the
 * scrim close it, and focus stays in it until then.
 */
export function ConsoleSheet({ isOpen, onClose, title, subtitle, footer, children }: ConsoleSheetProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay data-scrim="" className="fixed inset-0 z-overlay bg-scrim" />
        <Dialog.Content aria-describedby={undefined} data-sheet="console"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
          }}
          className="fixed inset-x-0 top-16 bottom-0 z-modal flex flex-col rounded-t-lg bg-raised text-content shadow-modal focus:outline-none medium:inset-x-auto medium:inset-y-0 medium:right-0 medium:w-side-panel medium:max-w-full medium:rounded-none">
          <div className="shrink-0 px-6 pt-5 pb-4">
            {/* The title and Close share one line, centred on it; Close's room beyond the line is taken back by its margins. */}
            <div className="flex items-center justify-between gap-3">
              <Dialog.Title className="min-w-0 font-text text-20 leading-snug font-semibold">{title}</Dialog.Title>
              <Dialog.Close aria-label={t('ui.console.sheet.close')} className={CLOSE}><Icon name="close" /></Dialog.Close>
            </div>
            {subtitle ? <p className="mt-1 font-text text-13 leading-snug text-content-muted">{subtitle}</p> : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-6 pt-2 pb-6">{children}</div>
          {footer ? <div className="flex shrink-0 items-center justify-end gap-2 border-t border-subtle px-6 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
