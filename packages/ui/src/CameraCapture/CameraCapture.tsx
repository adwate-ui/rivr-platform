import { t } from '@rivr/i18n';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Button } from '../Button/Button.tsx';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { cx } from '../internal/classes.ts';
import { QrCode } from '../QrCode/QrCode.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

export type CameraFacing = 'user' | 'environment';

export interface CameraCaptureProps {
  /** `user`, the front camera, for a selfie; `environment`, the back one, for a member's photo taken at the desk. */
  facing?: CameraFacing;
  /** An oval to fit a face into, for a selfie. */
  hasFaceGuide?: boolean;
  /** The photo the person kept, a JPEG of what the frame showed. */
  onPhoto: (photo: Blob) => void;
  /** While the kept photo is sent: Use photo turns busy and Retake waits. */
  isSending?: boolean;
  /** This step's address, for a QR code to carry on with a phone when this device has no camera. None, no QR code. */
  phoneUrl?: string | undefined;
  /** Why the photo was refused, under it, between the picture and its buttons, so a phone shows it in view. */
  error?: string | undefined;
}

/** Why the camera did not start: blocked by the person or the browser, no camera at all, or anything else. */
export type CameraTrouble = 'blocked' | 'none' | 'failed';

/** The browser's refusal as one of the three, by its DOMException's name. */
export function troubleOf(error: unknown): CameraTrouble {
  const name: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'name') : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'blocked';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotSupportedError') return 'none';
  return 'failed';
}

// Enough for liveness and a face match, and small to send: the app shrinks it again before it goes.
const LONGEST_SIDE = 1280;
const QUALITY = 0.9;

/** What the frame showed: the middle 3:4 of the camera's picture, mirrored when the preview is, as a JPEG. */
export async function photoOf(video: HTMLVideoElement, isMirrored: boolean): Promise<Blob> {
  const { videoWidth: width, videoHeight: height } = video;
  const cropWidth = Math.min(width, (height * 3) / 4);
  const cropHeight = Math.min(height, (width * 4) / 3);
  const scale = Math.min(1, LONGEST_SIDE / cropHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cropWidth * scale);
  canvas.height = Math.round(cropHeight * scale);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('No canvas to draw the photo on');
  if (isMirrored) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, (width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  return await new Promise((resolve, reject) => {
    canvas.toBlob((jpeg) => (jpeg ? resolve(jpeg) : reject(new Error('The photo was not made'))), 'image/jpeg', QUALITY);
  });
}

const stopAll = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop());

type CameraStatus = 'starting' | 'live' | CameraTrouble;

/** The camera facing that way, at up to 1280 by 960. An insecure page or an old browser has none to offer. */
async function openCamera(facing: CameraFacing): Promise<MediaStream> {
  if (!window.isSecureContext || !('mediaDevices' in navigator)) throw new DOMException('No camera here', 'NotSupportedError');
  return await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } } });
}

/**
 * The camera, on while `isOn`: the video element to show its picture in, and how starting it went; `retry` starts it again.
 * Every track stops when it goes off, so the camera's light goes out once the photo is taken.
 */
function useCamera(facing: CameraFacing, isOn: boolean) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>('starting');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isOn) return undefined;
    let stream: MediaStream | null = null;
    let isOver = false;
    const start = async () => {
      let next: CameraStatus = 'live';
      try {
        const opened = await openCamera(facing);
        if (isOver) {
          stopAll(opened);
          return;
        }
        stream = opened;
        if (video.current) {
          video.current.srcObject = opened;
          // autoPlay starts it too; a refused play() leaves that to the element.
          await Promise.resolve(video.current.play()).catch(() => undefined);
        }
      } catch (error) {
        next = troubleOf(error);
      }
      if (!isOver) setStatus(next);
    };
    void start();
    return () => {
      isOver = true;
      if (stream) stopAll(stream);
    };
  }, [facing, isOn, attempt]);
  const retry = () => {
    setStatus('starting');
    setAttempt((count) => count + 1);
  };
  const trouble = status === 'starting' || status === 'live' ? null : status;
  return { video, isLive: status === 'live', trouble, retry };
}

/** The dimmed surround and the oval a face fits into, over the picture. */
function FaceGuide() {
  const mask = useId();
  return (
    <svg aria-hidden="true" viewBox="0 0 30 40" preserveAspectRatio="none" className="absolute inset-0 size-full">
      <defs>
        <mask id={mask}>
          <rect width="30" height="40" fill="white" />
          <ellipse cx="15" cy="18" rx="9.5" ry="12.5" fill="black" />
        </mask>
      </defs>
      <rect width="30" height="40" mask={`url(#${mask})`} className="fill-raised opacity-muted" />
      <ellipse cx="15" cy="18" rx="9.5" ry="12.5" fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className="stroke-content" />
    </svg>
  );
}

/** The 3:4 frame the picture fills, as the photo will. */
function Frame({ children }: { children: ReactNode }) {
  return <div className="relative mx-auto aspect-portrait w-full overflow-hidden rounded-lg bg-raised">{children}</div>;
}

/**
 * Why there is no picture and what to do, announced as it appears, and Try again. With no camera at all, the QR code to
 * carry on with a phone; a blocked or busy camera is this device's own to sort out.
 */
function Trouble({ trouble, phoneUrl, onRetry }: { trouble: CameraTrouble; phoneUrl: string | undefined; onRetry: () => void }) {
  return (
    <Stack gap={6}>
      <div role="alert"><Text>{t(`ui.camera.${trouble}`)}</Text></div>
      {trouble === 'none' && phoneUrl ? (
        <Stack gap={3} align="center">
          <div className="size-photo rounded-md bg-cream p-3">
            <QrCode value={phoneUrl} label={t('ui.camera.phoneLink')} />
          </div>
          <Text variant="small" tone="muted" align="center">{t('ui.camera.onPhone')}</Text>
        </Stack>
      ) : null}
      <Button variant="secondary" fullWidth onClick={onRetry}>{t('ui.camera.tryAgain')}</Button>
    </Stack>
  );
}

interface ReviewProps {
  photo: Blob;
  isSending: boolean;
  error: string | undefined;
  onUse: () => void;
  onRetake: () => void;
}

/** The photo just taken, why it was refused if it was, and Use photo or Retake. */
function Review({ photo, isSending, error, onUse, onRetake }: ReviewProps) {
  const [url] = useState(() => URL.createObjectURL(photo));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <Stack gap={4}>
      <Frame>
        <img src={url} alt={t('ui.camera.review')} className="size-full object-cover" />
      </Frame>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      <Stack gap={3}>
        <Button variant="primary" fullWidth isLoading={isSending} onClick={onUse}>{t('ui.camera.use')}</Button>
        <Button variant="secondary" fullWidth isDisabled={isSending} onClick={onRetake}>{t('ui.camera.retake')}</Button>
      </Stack>
    </Stack>
  );
}

interface LiveProps {
  video: RefObject<HTMLVideoElement | null>;
  isLive: boolean;
  isMirrored: boolean;
  hasFaceGuide: boolean;
  onTake: () => void;
}

/** The live picture in its frame, the oval over it for a face, and Take photo once the picture is there. */
function Live({ video, isLive, isMirrored, hasFaceGuide, onTake }: LiveProps) {
  return (
    <Stack gap={4}>
      <Frame>
        <video ref={video} aria-label={t('ui.camera.preview')} autoPlay playsInline muted className={cx('size-full object-cover', isMirrored && '-scale-x-100')} />
        {hasFaceGuide ? <FaceGuide /> : null}
        {isLive ? null : (
          <div role="status" className="absolute inset-0 flex items-center justify-center">
            <Text tone="muted">{t('ui.camera.starting')}</Text>
          </div>
        )}
      </Frame>
      <Stack gap={3}>
        {hasFaceGuide ? <Text tone="muted" align="center">{t('ui.camera.faceGuide')}</Text> : null}
        <Button variant="primary" fullWidth isDisabled={!isLive} onClick={onTake}>{t('ui.camera.take')}</Button>
      </Stack>
    </Stack>
  );
}

/** The photo taken, with a count of photos so each gets its own review; one photo is made at a time, however fast the taps. */
function usePhoto(isMirrored: boolean) {
  const [taken, setTaken] = useState<{ photo: Blob; count: number } | null>(null);
  const isTaking = useRef(false);
  const take = async (video: HTMLVideoElement | null) => {
    if (isTaking.current || video === null) return;
    isTaking.current = true;
    const photo = await photoOf(video, isMirrored).catch(() => null);
    isTaking.current = false;
    if (photo) setTaken((last) => ({ photo, count: (last?.count ?? 0) + 1 }));
  };
  return { taken, take, clear: () => setTaken(null) };
}

/**
 * A photo taken there and then with the device's camera, on a phone or a computer (K-07): the live picture in a 3:4
 * frame, with an oval for a face; Take photo; then the photo to keep or retake. Never a file from the device: a KYC photo
 * is of the person in front of the camera. When the camera is blocked or missing it says what to do, and with no camera
 * offers a QR code to carry on with a phone.
 */
export function CameraCapture({ facing = 'user', hasFaceGuide = false, onPhoto, isSending = false, phoneUrl, error }: CameraCaptureProps) {
  const isMirrored = facing === 'user';
  const shot = usePhoto(isMirrored);
  const camera = useCamera(facing, shot.taken === null);
  const retake = () => {
    shot.clear();
    camera.retry();
  };
  const { taken } = shot;
  const view = taken ? <Review key={taken.count} photo={taken.photo} isSending={isSending} error={error} onUse={() => onPhoto(taken.photo)} onRetake={retake} />
    : camera.trouble ? <Trouble trouble={camera.trouble} phoneUrl={phoneUrl} onRetry={camera.retry} />
    : <Live video={camera.video} isLive={camera.isLive} isMirrored={isMirrored} hasFaceGuide={hasFaceGuide} onTake={() => void shot.take(camera.video.current)} />;
  // A phone's width at most, so a photo on the console is not a picture the height of the screen.
  return <div className="mx-auto w-full max-w-phone">{view}</div>;
}
