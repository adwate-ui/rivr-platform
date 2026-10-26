import type { KeyboardEvent, Ref } from 'react';
import { Heading } from '../Heading/Heading.tsx';
import { cx } from '../internal/classes.ts';
import { Text } from '../Text/Text.tsx';

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
  /** Shown over the picture when the camera cannot start: "The camera is not available. Please see the front desk." */
  cameraError?: string | undefined;
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

/**
 * The door kiosk's scanner (decision 0164): the camera's picture on the left, framed, with what to do
 * above it; on the right, large, what the last scan did. A card scanner plugged in types into a field
 * that holds the focus, with no on-screen keyboard. It holds no state and reads no picture: the app
 * attaches the camera and decodes the frames.
 */
export function QrScanView({ videoRef, prompt, result, cameraError, scannerLabel, onScannerCode }: QrScanViewProps) {
  return (
    <div className="grid grid-cols-2 items-center gap-12">
      {/* A kiosk has nothing else to focus: a tap elsewhere hands the focus back, for the card scanner. */}
      <input className="sr-only" aria-label={scannerLabel} inputMode="none" autoComplete="off" autoFocus
        onBlur={(event) => event.currentTarget.focus()} onKeyDown={(event) => onScannerKey(event, onScannerCode)} />
      <div className="flex flex-col gap-4">
        <Heading level={1} variant="title">{prompt}</Heading>
        <div className="relative aspect-photo overflow-hidden rounded-lg border border-hairline bg-raised">
          <video ref={videoRef} className="size-full object-cover" muted playsInline aria-hidden="true" />
          {cameraError === undefined ? null : (
            <div className="absolute inset-0 flex items-center justify-center bg-raised p-8">
              <Text tone="muted" align="center">{cameraError}</Text>
            </div>
          )}
        </div>
      </div>
      <div role="status" aria-live="polite" className="flex flex-col gap-4">
        {result === undefined ? null : (
          <>
            <p className={cx('font-display text-56 leading-tight', result.isRefused ? 'text-content' : 'text-money')}>{result.title}</p>
            {result.detail === undefined ? null : <Text variant="lead" tone={result.isRefused ? 'default' : 'muted'}>{result.detail}</Text>}
          </>
        )}
      </div>
    </div>
  );
}
