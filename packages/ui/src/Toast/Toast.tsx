import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** One toast: what the member's own action did, and how to undo it when it can be undone. */
export interface ToastMessage {
  text: string;
  onUndo?: (() => void) | undefined;
}

export interface ToastProps extends ToastMessage {
  /** Undo was pressed: the toast goes as its action is undone. */
  onClose: () => void;
}

/** How long a toast stays, from the tokens: 3.2 s. */
export const TOAST_MS = Number.parseInt(String(tokens.motion.duration.toast), 10);
/** How long a toast with Undo stays on the console, from the tokens: 5 s, so its change can be taken back (console v3). */
export const UNDO_TOAST_MS = Number.parseInt(String(tokens.motion.duration.toastUndo), 10);

/**
 * A toast on its own, as the provider shows it: cream, with Undo when it can be undone. The provider's status region,
 * there all along, reads it out politely as it comes.
 */
export function Toast({ text, onUndo, onClose }: ToastProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-cream px-4 py-3 font-text text-16 font-medium text-on-cream shadow-modal"
      data-toast="">
      <span>{text}</span>
      {onUndo ? (
        <button type="button" className="min-h-touch shrink-0 font-semibold text-green underline"
          onClick={() => { onClose(); onUndo(); }}>
          {t('ui.toast.undo')}
        </button>
      ) : null}
    </div>
  );
}

type ShowToast = (text: string, options?: { onUndo?: () => void }) => void;

const ToastContext = createContext<ShowToast | null>(null);

export interface ToastProviderProps {
  children: ReactNode;
  /**
   * `player`, above the player app's tab bar at a phone's width (decision 0320); `console`, centred at the foot of the
   * console as wide as its words, above the tab bar below 768 px (console v3).
   */
  place?: 'player' | 'console';
}

const PLACE = {
  player: 'mx-auto px-5 pb-5 medium:max-w-phone',
  console: 'flex justify-center px-4 pb-4 medium:bottom-0 medium:pb-6',
} as const;

/**
 * Confirms the staff member's or member's own action at the foot of the screen (decision 0320): "Joined waitlist", with
 * Undo when it can be undone. One at a time; a new one replaces the last. It goes after 3.2 s, or on the console 5 s with Undo. Its status region is there
 * all along, empty between toasts, so each is announced as it comes.
 */
export function ToastProvider({ children, place = 'player' }: ToastProviderProps) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const close = useCallback(() => setMessage(null), []);
  const show = useCallback<ShowToast>((text, options) => {
    clearTimeout(timer.current);
    setMessage({ text, onUndo: options?.onUndo });
    timer.current = setTimeout(close, place === 'console' && options?.onUndo !== undefined ? UNDO_TOAST_MS : TOAST_MS);
  }, [close, place]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext value={value}>
      {children}
      <div role="status" aria-live="polite" className={`pointer-events-none fixed inset-x-0 bottom-bottom-nav z-modal ${PLACE[place]}`}>
        {message ? (
          <div className="pointer-events-auto max-w-palette">
            <Toast text={message.text} onUndo={message.onUndo} onClose={close} />
          </div>
        ) : null}
      </div>
    </ToastContext>
  );
}

/** Shows a toast: `toast('Joined waitlist', { onUndo })`. Inside a ToastProvider. */
export function useToast(): ShowToast {
  const show = use(ToastContext);
  if (show === null) throw new Error('useToast needs a ToastProvider above it');
  return show;
}
