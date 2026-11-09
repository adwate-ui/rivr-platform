import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Button } from '../Button/Button.tsx';
import { Trouble, useCamera } from '../CameraCapture/CameraCapture.tsx';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { cx } from '../internal/classes.ts';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { cardIn, frameIn } from './cardLook.ts';
import type { CoverBar } from './coverBars.ts';
import { CoverPhoto } from './CoverPhoto.tsx';
import { cardPhotoOf, useCardGuidance, useTorch } from './useCardCamera.ts';

export interface DocumentCameraProps {
  /** What is being photographed: `PAN card`. Shown above the camera and read out. */
  label: string;
  /** Bars to place over parts of the photo before it is kept. None, and the photo is kept whole. */
  covers?: readonly CoverBar[] | undefined;
  /** Beside the switch that says the bars are in place. Needed with `covers`. */
  coverConfirm?: string | undefined;
  /** The photo kept, covered if it has bars. */
  onPhoto: (photo: Blob) => void;
  /** This step's address, for a QR code to carry on with a phone when this device has no camera. */
  phoneUrl?: string | undefined;
}

const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 300;
const OUTLINE = cardIn(frameIn(VIEW_WIDTH, VIEW_HEIGHT));
const CORNER = tokens.radius.lg;

/** The dimmed surround and the card's outline, which turns gold once a card is lined up and holding good. */
function CardOutline({ isGood }: { isGood: boolean }) {
  const mask = useId();
  const outline = { x: OUTLINE.x, y: OUTLINE.y, width: OUTLINE.width, height: OUTLINE.height, rx: CORNER };
  return (
    <svg aria-hidden="true" data-outline={isGood ? 'good' : 'waiting'} viewBox={`0 0 ${String(VIEW_WIDTH)} ${String(VIEW_HEIGHT)}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
      <defs>
        <mask id={mask}>
          <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="white" />
          <rect {...outline} fill="black" />
        </mask>
      </defs>
      <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} mask={`url(#${mask})`} className="fill-raised opacity-muted" />
      <rect {...outline} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className={cx('transition-colors', isGood ? 'stroke-gold' : 'stroke-content')} />
    </svg>
  );
}

interface LiveProps {
  video: RefObject<HTMLVideoElement | null>;
  isLive: boolean;
  label: string;
  hasFailed: boolean;
  onTake: () => void;
}

/** The live picture with the card's outline and what to do next, read out politely as it changes; the shutter always works. */
function Live({ video, isLive, label, hasFailed, onTake }: LiveProps) {
  const hint = useCardGuidance(video, isLive, onTake);
  const torch = useTorch(video, isLive);
  return (
    <Stack gap={4}>
      <Text weight="medium">{label}</Text>
      <div className="relative aspect-photo w-full overflow-hidden rounded-lg bg-raised">
        <video ref={video} aria-label={t('ui.camera.preview')} autoPlay playsInline muted className="size-full object-cover" />
        <CardOutline isGood={hint === 'steady' || hint === 'capturing'} />
        {isLive ? null : (
          <div role="status" className="absolute inset-0 flex items-center justify-center">
            <Text tone="muted">{t('ui.camera.starting')}</Text>
          </div>
        )}
      </div>
      <div aria-live="polite"><Text align="center">{t(`ui.documentCamera.${hint}`)}</Text></div>
      {hasFailed ? <ErrorMessage>{t('ui.documentCamera.coverFailed')}</ErrorMessage> : null}
      <Stack gap={3}>
        <Button variant="primary" fullWidth isDisabled={!isLive} onClick={onTake}>{t('ui.camera.take')}</Button>
        {torch.canToggle ? <Button variant="secondary" fullWidth onClick={torch.toggle}>{t(torch.isOn ? 'ui.documentCamera.lightOff' : 'ui.documentCamera.lightOn')}</Button> : null}
      </Stack>
    </Stack>
  );
}

interface ReviewProps {
  photo: Blob;
  label: string;
  onUse: () => void;
  onRetake: () => void;
}

/** The card as taken, to look at close up before keeping it: a photo nobody can read is worth nothing later. */
function Review({ photo, label, onUse, onRetake }: ReviewProps) {
  const [url] = useState(() => URL.createObjectURL(photo));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [isClose, setClose] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  // A close look starts at the middle of the card, not its top corner, where there is nothing to read.
  useEffect(() => {
    const box = frame.current;
    if (box === null || !isClose) return;
    box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2;
    box.scrollTop = (box.scrollHeight - box.clientHeight) / 2;
  }, [isClose]);
  return (
    <Stack gap={4}>
      <Text weight="medium">{label}</Text>
      <Text tone="muted">{t('ui.documentCamera.checkRead')}</Text>
      {/* Close up it scrolls, so it can be reached and moved with the keyboard too. */}
      <div ref={frame} tabIndex={isClose ? 0 : undefined} role={isClose ? 'group' : undefined} aria-label={isClose ? label : undefined} className="aspect-card w-full overflow-auto rounded-lg bg-raised">
        <img src={url} alt={label} className={isClose ? 'max-w-none' : 'size-full object-cover'} />
      </div>
      <Button variant="text" onClick={() => setClose(!isClose)}>{t(isClose ? 'ui.documentCamera.whole' : 'ui.documentCamera.closeUp')}</Button>
      <Stack gap={3}>
        <Button variant="primary" fullWidth onClick={onUse}>{t('ui.camera.use')}</Button>
        <Button variant="secondary" fullWidth onClick={onRetake}>{t('ui.camera.retake')}</Button>
      </Stack>
    </Stack>
  );
}

/**
 * A photo of a card, taken there and then with the back camera: a card-shaped outline, live prompts for glare, poor light and
 * a shaking hand, the photo taking itself once the card is good, and a close look before it is kept. With `covers`, bars go
 * over what must not be kept. Never a file from the device: the card is in the hand of the person taking it.
 */
export function DocumentCamera({ label, covers, coverConfirm, onPhoto, phoneUrl }: DocumentCameraProps) {
  const [taken, setTaken] = useState<{ photo: Blob; count: number } | null>(null);
  const camera = useCamera('environment', taken === null, 'document');
  const isTaking = useRef(false);
  const [hasFailed, setFailed] = useState(false);
  const take = async () => {
    if (isTaking.current || camera.video.current === null) return;
    isTaking.current = true;
    const photo = await cardPhotoOf(camera.video.current).catch(() => null);
    isTaking.current = false;
    setFailed(photo === null);
    if (photo) setTaken((last) => ({ photo, count: (last?.count ?? 0) + 1 }));
  };
  const retake = () => {
    setTaken(null);
    camera.retry();
  };
  const reviewOf = ({ photo, count }: { photo: Blob; count: number }) => (covers === undefined
    ? <Review key={count} photo={photo} label={label} onUse={() => onPhoto(photo)} onRetake={retake} />
    : <CoverPhoto key={count} photo={photo} label={label} covers={covers} confirm={coverConfirm ?? ''} onUse={onPhoto} onRetake={retake} />);
  const view = taken ? reviewOf(taken)
    : camera.trouble ? <Trouble trouble={camera.trouble} phoneUrl={phoneUrl} onRetry={camera.retry} />
    : <Live video={camera.video} isLive={camera.isLive} label={label} hasFailed={hasFailed} onTake={() => void take()} />;
  return <div className="mx-auto w-full max-w-phone">{view}</div>;
}
