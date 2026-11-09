import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../Icon/Icon.tsx';

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
/**
 * How long a toast with Undo stays at least, from the tokens: 20 s, paused while hovered or focused, and it has Close, so
 * its change can be taken back at the member's pace (WCAG 2.2.1).
 */
export const UNDO_TOAST_MS = Number.parseInt(String(tokens.motion.duration.toastUndo), 10);

/**
 * A toast on its own, as the provider shows it: cream, with Undo and Close when it can be undone. The provider's status
 * region, there all along, reads it out politely as it comes.
 */
export function Toast({ text, onUndo, onClose }: ToastProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-cream px-4 py-3 font-text text-16 font-medium text-on-cream shadow-modal"
      data-toast="">
      <span>{text}</span>
      {onUndo ? (
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" className="min-h-touch font-semibold text-green underline"
            onClick={() => { onClose(); onUndo(); }}>
            {t('ui.toast.undo')}
          </button>
          <button type="button" aria-label={t('ui.toast.close')} onClick={onClose}
            className="flex size-touch items-center justify-center rounded-md text-green focus-visible:outline focus-visible:outline-focus">
            <Icon name="close" size="md" />
          </button>
        </span>
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
  player: 'safe-mb mx-auto px-5 pb-5 medium:max-w-phone',
  console: 'flex justify-center px-4 pb-4 medium:bottom-0 medium:pb-6',
} as const;

/** Why a toast's time is held: the person's pointer, their focus, or both. */
type ToastHold = 'pointer' | 'focus';

/**
 * The toast's time, held while the person's pointer or focus is on it and counted again from the start once neither is,
 * so a pointer passing over a focused toast never lets it go under the focus.
 */
function useToastTimer(close: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const duration = useRef(TOAST_MS);
  const holds = useRef(new Set<ToastHold>());
  const start = useCallback((ms: number) => {
    clearTimeout(timer.current);
    duration.current = ms;
    holds.current.clear();
    timer.current = setTimeout(close, ms);
  }, [close]);
  const hold = useCallback((why: ToastHold) => {
    holds.current.add(why);
    clearTimeout(timer.current);
  }, []);
  const release = useCallback((why: ToastHold) => {
    holds.current.delete(why);
    if (holds.current.size > 0) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(close, duration.current);
  }, [close]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useMemo(() => ({ start, hold, release }), [start, hold, release]);
}

/**
 * Confirms the staff member's or member's own action at the foot of the screen (decision 0320): "Joined waitlist", with
 * Undo when it can be undone. One at a time; a new one replaces the last. It goes after 3.2 s; with Undo after 20 s, held
 * while hovered or focused, or on Close (WCAG 2.2.1). Its status region is there all along, empty between toasts, so each
 * is announced as it comes.
 */
export function ToastProvider({ children, place = 'player' }: ToastProviderProps) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const close = useCallback(() => setMessage(null), []);
  const timer = useToastTimer(close);
  const show = useCallback<ShowToast>((text, options) => {
    setMessage({ text, onUndo: options?.onUndo });
    timer.start(options?.onUndo === undefined ? TOAST_MS : UNDO_TOAST_MS);
  }, [timer]);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext value={value}>
      {children}
      <div role="status" aria-live="polite" className={`pointer-events-none fixed inset-x-0 bottom-bottom-nav z-modal ${PLACE[place]}`}>
        {message ? (
          <div className="pointer-events-auto max-w-palette" onPointerEnter={() => timer.hold('pointer')} onPointerLeave={() => timer.release('pointer')}
            onFocus={() => timer.hold('focus')} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) timer.release('focus'); }}>
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
