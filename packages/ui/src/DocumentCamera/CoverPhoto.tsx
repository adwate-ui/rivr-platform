import { t } from '@rivr/i18n';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { Button } from '../Button/Button.tsx';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Switch } from '../Switch/Switch.tsx';
import { Text } from '../Text/Text.tsx';
import { coveredPhoto, moved, NEW_COVER, resized, type CoverBar } from './coverBars.ts';

const STEP = 0.01;
const ARROWS: Readonly<Record<string, readonly [number, number]>> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

interface Drag {
  readonly bar: CoverBar;
  readonly x: number;
  readonly y: number;
  readonly change: typeof moved;
}

interface BarProps {
  bar: CoverBar;
  number: number;
  surface: RefObject<HTMLDivElement | null>;
  onChange: (bar: CoverBar) => void;
}

/** One bar over the photo: dragged to move, dragged by its corner to resize; arrow keys move it and, with Shift, resize it. */
function Bar({ bar, number, surface, onChange }: BarProps) {
  const drag = useRef<Drag | null>(null);
  const begin = (event: PointerEvent<HTMLElement>, change: typeof moved) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { bar, x: event.clientX, y: event.clientY, change };
  };
  const follow = (event: PointerEvent<HTMLElement>) => {
    const box = surface.current?.getBoundingClientRect();
    if (drag.current === null || box === undefined) return;
    onChange(drag.current.change(drag.current.bar, (event.clientX - drag.current.x) / box.width, (event.clientY - drag.current.y) / box.height));
  };
  const end = () => { drag.current = null; };
  const press = (event: KeyboardEvent<HTMLElement>) => {
    const arrow = ARROWS[event.key];
    if (arrow === undefined) return;
    event.preventDefault();
    onChange((event.shiftKey ? resized : moved)(bar, arrow[0] * STEP, arrow[1] * STEP));
  };
  const place = { left: `${String(bar.x * 100)}%`, top: `${String(bar.y * 100)}%`, width: `${String(bar.width * 100)}%`, height: `${String(bar.height * 100)}%` };
  return (
    <button type="button" aria-label={t('ui.documentCamera.coverName', { number })} style={place} onKeyDown={press}
      onPointerDown={(event) => begin(event, moved)} onPointerMove={follow} onPointerUp={end} onPointerCancel={end}
      className="absolute cursor-move touch-none border border-gold bg-green-black">
      {/* A finger's width to grab, around the dot that shows. */}
      <span aria-hidden="true" onPointerDown={(event) => begin(event, resized)} onPointerMove={follow} onPointerUp={end} onPointerCancel={end}
        className="absolute bottom-0 right-0 flex size-touch translate-x-1/2 translate-y-1/2 touch-none items-center justify-center">
        <span className="size-6 rounded-full bg-gold" />
      </span>
    </button>
  );
}

export interface CoverPhotoProps {
  photo: Blob;
  /** What the photo is of, read out. */
  label: string;
  covers: readonly CoverBar[];
  /** Beside the switch that says the bars are where they must be. */
  confirm: string;
  onUse: (covered: Blob) => void;
  onRetake: () => void;
}

/**
 * The photo with bars to place over what must not be kept. The bars start where that sits on the card, and the person
 * holding the card moves them onto it. Use photo stays off until they say the bars are in place, and any bar moved after
 * that asks again. The bars are painted into the picture here, so only the covered copy ever leaves the device. Only the photo
 * is clipped, so a handle at the card's edge can still be reached.
 */
export function CoverPhoto({ photo, label, covers, confirm, onUse, onRetake }: CoverPhotoProps) {
  const [url] = useState(() => URL.createObjectURL(photo));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const surface = useRef<HTMLDivElement>(null);
  const [bars, setBars] = useState(covers);
  const [isConfirmed, setConfirmed] = useState(false);
  const [isBusy, setBusy] = useState(false);
  const [hasFailed, setFailed] = useState(false);
  const change = (next: readonly CoverBar[]) => {
    setBars(next);
    setConfirmed(false);
  };
  const use = async () => {
    setBusy(true);
    const covered = await coveredPhoto(photo, bars).catch(() => null);
    setBusy(false);
    setFailed(covered === null);
    if (covered !== null) onUse(covered);
  };
  return (
    <Stack gap={4}>
      <Text tone="muted">{t('ui.documentCamera.coverHelp')}</Text>
      <div ref={surface} className="relative aspect-card w-full">
        <div className="size-full overflow-hidden rounded-lg bg-raised">
          <img src={url} alt={label} className="size-full object-cover" />
        </div>
        {bars.map((bar, index) => (
          // A bar's place in the list is the only name it has, and none is ever removed.
          <Bar key={index} bar={bar} number={index + 1} surface={surface} onChange={(next) => change(bars.map((one, at) => (at === index ? next : one)))} />
        ))}
      </div>
      <Button variant="text" onClick={() => change([...bars, NEW_COVER])}>{t('ui.documentCamera.addCover')}</Button>
      <Switch label={confirm} isOn={isConfirmed} onChange={setConfirmed} />
      {hasFailed ? <ErrorMessage>{t('ui.documentCamera.coverFailed')}</ErrorMessage> : null}
      <Stack gap={3}>
        <Button variant="primary" fullWidth isDisabled={!isConfirmed} isLoading={isBusy} onClick={() => void use()}>{t('ui.camera.use')}</Button>
        <Button variant="secondary" fullWidth isDisabled={isBusy} onClick={onRetake}>{t('ui.camera.retake')}</Button>
      </Stack>
    </Stack>
  );
}
