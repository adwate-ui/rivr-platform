import { t } from '@rivr/i18n';
import { useId, useRef, useState, type PointerEvent } from 'react';
import { Button } from '../Button/Button.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

export interface SignaturePadProps {
  /** What is signed for, shown above the pad and read out: "Signature of Neel Bose for ₹10,000". */
  label: string;
  /** The signature as SVG path data once a stroke is finished; null when cleared. */
  onChange: (path: string | null) => void;
  /** A signature already given, as path data: shown until cleared. */
  defaultValue?: string;
}

// The pad's own units, whatever its size on screen.
const WIDTH = 300;
const HEIGHT = 100;
// The database keeps a signature of up to 20,000 characters.
const MAX_LENGTH = 19_000;

/** Where a pointer is on the pad, in its own units. */
function pointOf(event: PointerEvent<SVGSVGElement>): string {
  const box = event.currentTarget.getBoundingClientRect();
  const x = Math.round(((event.clientX - box.left) / (box.width || WIDTH)) * WIDTH);
  const y = Math.round(((event.clientY - box.top) / (box.height || HEIGHT)) * HEIGHT);
  return `${Math.min(Math.max(x, 0), WIDTH)} ${Math.min(Math.max(y, 0), HEIGHT)}`;
}

/**
 * A member signs with a finger or a pen on the cage screen (#74), under what they sign for: each
 * stroke is kept as SVG path data, given once the stroke ends; Clear starts again.
 */
export function SignaturePad({ label, onChange, defaultValue }: SignaturePadProps) {
  const labelId = useId();
  const [strokes, setStrokes] = useState<string[]>(defaultValue ? [defaultValue] : []);
  const drawn = useRef<string[]>(strokes);
  const isDrawing = useRef(false);
  const isFull = () => drawn.current.join(' ').length > MAX_LENGTH;
  const draw = (next: string[]) => { drawn.current = next; setStrokes(next); };
  const start = (event: PointerEvent<SVGSVGElement>) => {
    if (isFull()) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    isDrawing.current = true;
    draw([...drawn.current, `M ${pointOf(event)}`]);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current || isFull()) return;
    const last = drawn.current[drawn.current.length - 1] ?? '';
    draw([...drawn.current.slice(0, -1), `${last} L ${pointOf(event)}`]);
  };
  const end = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    onChange(drawn.current.join(' '));
  };
  const clear = () => { draw([]); onChange(null); };
  return (
    <Stack gap={2} align="start">
      <span id={labelId}><Text as="span" variant="small" tone="muted">{label}</Text></span>
      <svg role="img" aria-labelledby={labelId} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
        className="h-32 w-full touch-none rounded-md border border-hairline bg-raised">
        {strokes.map((stroke, index) => <path key={index} d={stroke} className="fill-none stroke-cream" strokeWidth={2} strokeLinecap="round" />)}
      </svg>
      <Button variant="text" isDisabled={strokes.length === 0} onClick={clear}>{t('ui.signaturePad.clear')}</Button>
    </Stack>
  );
}
