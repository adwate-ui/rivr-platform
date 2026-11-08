import { useRef, type KeyboardEvent, type Ref } from 'react';
import { Button } from '../Button/Button.tsx';
import { DoneMark } from '../DoneMark/DoneMark.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { Text } from '../Text/Text.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

/** What the last scan did: a large line ("Welcome, Kavya."), a line beneath, and whether it went through. */
export interface QrScanResult {
  title: string;
  detail?: string | undefined;
  isRefused: boolean;
}

export interface QrScanViewProps {
  /** The camera's picture: the app attaches the camera's stream to this video. */
  videoRef: Ref<HTMLVideoElement>;
  /** Above the picture, what to do: "Hold your RIVR card up to the camera". */
  prompt: string;
  /** What the last scan did, until the next; nothing between scans. */
  result?: QrScanResult | undefined;
  /** Between scans, beside the picture, where the card is: "Open RIVR › Card, turn brightness up." */
  help: string;
  /** Shown large over the picture when the camera cannot start: "Camera unavailable. See the front desk." */
  cameraError?: string | undefined;
  /** The button with `cameraError`, and what it does. */
  retryCameraLabel: string;
  onRetryCamera: () => void;
  /** The name of the field a card scanner plugged into the kiosk types into: "Card scanner". */
  scannerLabel: string;
  /** What a card scanner typed, on its Enter. */
  onScannerCode: (code: string) => void;
}

/** A card scanner types the code and presses Enter, as a keyboard does; the field is emptied for the next card. */
function onScannerKey(event: KeyboardEvent<HTMLInputElement>, onScannerCode: (code: string) => void) {
  if (event.key !== 'Enter') return;
  const code = event.currentTarget.value.trim();
  event.currentTarget.value = '';
  if (code !== '') onScannerCode(code);
}

/** Whether the focus went to a control the keyboard reaches with Tab, not to nothing or a container focused by script. */
function isTabStop(next: EventTarget | null): boolean {
  return next instanceof HTMLElement && next.tabIndex >= 0;
}

/** What the last scan did, told apart from a step away: a tick in cream, or an alert on a red-edged panel; the reason in words either way (F-143). */
function ScanOutcome({ result }: { result: QrScanResult }) {
  return (
    <div className={cx('flex flex-col items-start gap-4 text-content', result.isRefused && 'rounded-lg border-2 border-alert p-8')}>
      {result.isRefused ? <Icon name="alert" size="xl" /> : <DoneMark />}
      <p className="font-display text-56 leading-tight text-content wrap-anywhere">{result.title}</p>
      {result.detail === undefined ? null : <Text variant="lead">{result.detail}</Text>}
    </div>
  );
}

/**
 * The door kiosk's scanner (decision 0164): the camera's picture on the left, framed and mirrored as the front camera is, with
 * what to do above it; on the right, the club's mark and where the card is, then large, what the last scan did. A card scanner
 * plugged in types into a field that holds the focus, with no on-screen keyboard. It holds no state and reads no picture: the
 * app attaches the camera and decodes the frames.
 */
export function QrScanView({ videoRef, prompt, result, help, cameraError, retryCameraLabel, onRetryCamera, scannerLabel, onScannerCode }: QrScanViewProps) {
  const field = useRef<HTMLInputElement>(null);
  return (
    <div className="grid grid-cols-2 items-center gap-12">
      {/* A tap anywhere else, on nothing or on the shell's main, hands the focus back, for the card scanner; Tab to Skip to
          content or a banner's action leaves it there, so the keyboard is never trapped (WCAG 2.1.2). */}
      <input ref={field} className="sr-only" aria-label={scannerLabel} inputMode="none" autoComplete="off" autoFocus
        onBlur={(event) => { if (!isTabStop(event.relatedTarget)) event.currentTarget.focus(); }} onKeyDown={(event) => onScannerKey(event, onScannerCode)} />
      <div className="flex flex-col gap-4">
        <Heading level={1} variant="title">{prompt}</Heading>
        <div className="relative aspect-photo overflow-hidden rounded-lg border border-hairline bg-raised">
          <video ref={videoRef} className="size-full -scale-x-100 object-cover" muted playsInline aria-hidden="true" />
          {cameraError === undefined ? null : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-raised p-8">
              <p className="text-center font-display text-36 leading-tight text-content">{cameraError}</p>
              <Button variant="secondary" onClick={() => { onRetryCamera(); field.current?.focus(); }}>{retryCameraLabel}</Button>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-8">
        {result === undefined ? (
          <>
            <Wordmark size="lg" withTagline />
            <Text variant="lead">{help}</Text>
          </>
        ) : null}
        <div role="status" aria-live="polite">{result === undefined ? null : <ScanOutcome result={result} />}</div>
      </div>
    </div>
  );
}
