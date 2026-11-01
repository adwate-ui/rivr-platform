import { t } from '@rivr/i18n';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button } from '../Button/index.ts';
import { ErrorMessage } from '../ErrorMessage/index.ts';
import { Stack } from '../Stack/index.ts';

export interface CaptchaProps {
  /** Cloudflare Turnstile's site key. Empty (a local stack, or before the owner adds one) draws nothing. */
  siteKey: string;
  /** A fresh token, or null when it expires or the check fails. Each token is good for one request. */
  onToken: (token: string | null) => void;
  /** Changing it asks for a new token, once the last one has been used. */
  renewKey?: number;
}

/** The parts of Cloudflare's Turnstile API the widget uses. */
interface Turnstile {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function isTurnstile(value: unknown): value is Turnstile {
  return typeof value === 'object' && value !== null && 'render' in value && 'reset' in value && 'remove' in value;
}

let loading: Promise<Turnstile> | null = null;

/** Cloudflare's script, loaded once for the page. */
function loadTurnstile(): Promise<Turnstile> {
  const ready: unknown = Reflect.get(window, 'turnstile');
  if (isTurnstile(ready)) return Promise.resolve(ready);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      const loaded: unknown = Reflect.get(window, 'turnstile');
      if (isTurnstile(loaded)) {
        resolve(loaded);
        return;
      }
      // A page that answered in its place, such as a network's block page: Try again loads it afresh.
      loading = null;
      reject(new Error('Turnstile did not load'));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('Turnstile did not load'));
    };
    document.head.append(script);
  });
  return loading;
}

/**
 * Proves a person, not a script, is asking for a sign-in code (#182): Cloudflare Turnstile, which
 * Supabase Auth checks with every code request. It only asks the person to do something when
 * Cloudflare is unsure; otherwise nothing shows. When the check cannot load or fails, as when
 * Cloudflare is blocked, it says so with Try again, so the step is never stuck without a word (F1-15).
 */
export function Captcha({ siteKey, onToken, renewKey = 0 }: CaptchaProps) {
  const host = useRef<HTMLDivElement>(null);
  const handler = useRef(onToken);
  const [attempt, setAttempt] = useState(0);
  const [isFailed, setFailed] = useState(false);
  useEffect(() => {
    handler.current = onToken;
  });
  const widget = useTurnstileWidget({ host, siteKey, attempt, handler, onFailed: setFailed });

  useEffect(() => {
    if (renewKey === 0 || !widget.current) return;
    handler.current(null);
    widget.current.turnstile.reset(widget.current.id);
  }, [renewKey, widget]);

  if (!siteKey) return null;
  return (
    <>
      <div ref={host} />
      {isFailed ? (
        <Stack gap={2} align="start">
          <ErrorMessage>{t('ui.captcha.failed')}</ErrorMessage>
          <Button variant="secondary" onClick={() => { setFailed(false); setAttempt((count) => count + 1); }}>{t('common.retry')}</Button>
        </Stack>
      ) : null}
    </>
  );
}

interface WidgetOptions {
  host: RefObject<HTMLDivElement | null>;
  siteKey: string;
  /** Each new attempt draws the widget again, as Try again asks. */
  attempt: number;
  handler: RefObject<(token: string | null) => void>;
  onFailed: (isFailed: boolean) => void;
}

/** Draws Turnstile's widget in `host`, handing each token to `handler`, and says when it cannot load or fails. */
function useTurnstileWidget({ host, siteKey, attempt, handler, onFailed }: WidgetOptions) {
  const widget = useRef<{ turnstile: Turnstile; id: string } | null>(null);
  useEffect(() => {
    const element = host.current;
    if (!siteKey || !element) return undefined;
    let isGone = false;
    const fail = () => {
      if (isGone) return;
      onFailed(true);
      handler.current(null);
    };
    loadTurnstile()
      .then((turnstile) => {
        if (isGone) return;
        const id = turnstile.render(element, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          theme: 'dark',
          callback: (token: string) => {
            if (isGone) return;
            onFailed(false);
            handler.current(token);
          },
          'expired-callback': () => handler.current(null),
          'error-callback': fail,
        });
        widget.current = { turnstile, id };
      })
      .catch(fail);
    return () => {
      isGone = true;
      if (widget.current) widget.current.turnstile.remove(widget.current.id);
      widget.current = null;
    };
  }, [host, siteKey, attempt, handler, onFailed]);
  return widget;
}

/**
 * The token a code request carries, for a step that sends one: `props` go to Captcha, `token` with
 * the request, and `renew()` after it, since a token is good once. Without a site key no token is
 * needed, and `isReady` is always true.
 */
export function useCaptcha(siteKey: string) {
  const [token, setToken] = useState<string | null>(null);
  const [renewKey, setRenewKey] = useState(0);
  return {
    isReady: !siteKey || token !== null,
    token: token ?? undefined,
    renew: () => setRenewKey((count) => count + 1),
    props: { siteKey, onToken: setToken, renewKey },
  };
}
