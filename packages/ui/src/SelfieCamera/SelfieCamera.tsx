import { t } from '@rivr/i18n';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button } from '../Button/Button.tsx';
import { photoOf, Trouble, useCamera } from '../CameraCapture/CameraCapture.tsx';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { usePageTitle } from '../Screen/Screen.tsx';
import { cx } from '../internal/classes.ts';
import { useFaceGuidance, type Guidance } from './faceGuidance.ts';

export interface SelfieCameraProps {
  /** The selfie the member kept. */
  onPhoto: (photo: Blob) => void;
  /** While the kept photo is sent: Use photo turns busy and Retake waits. */
  isSending?: boolean;
  /** Why the photo was refused, on the review. */
  error?: string | undefined;
  /** Back to the identity steps. */
  onBack: () => void;
  /** This step's address, for a QR code to carry on with a phone when this device has no camera. */
  phoneUrl?: string | undefined;
}

const TIPS = ['tipLight', 'tipCap', 'tipAlone'] as const;

/** The live line under the oval, read out politely as it changes; none where the browser cannot see a face. */
function GuidanceLine({ guidance }: { guidance: Guidance | null }) {
  return (
    <span aria-live="polite" className="mt-6 min-h-6 font-text text-18 font-medium text-content">
      {guidance === null ? '' : t(`ui.selfie.${guidance}`)}
    </span>
  );
}

interface LiveProps {
  video: RefObject<HTMLVideoElement | null>;
  isLive: boolean;
  onTake: () => void;
  onBack: () => void;
}

/**
 * The camera full-bleed (decision 0320): Back and "Selfie" above, the picture veiled but for a 250 × 330 oval, whose edge
 * turns gold once a face fills it; the live line, three tips and the 76 px shutter. The photo takes itself once one face has
 * held still in the oval for a second, where the browser can see faces.
 */
function Live({ video, isLive, onTake, onBack }: LiveProps) {
  const guidance = useFaceGuidance(video, isLive, onTake);
  const isGood = guidance === 'steady' || guidance === 'capturing';
  return (
    <div className="safe-bottom fixed inset-0 z-modal mx-auto flex flex-col items-center overflow-hidden bg-green-black text-content medium:max-w-phone">
      <video ref={video} aria-label={t('ui.camera.preview')} autoPlay playsInline muted className="absolute inset-0 size-full -scale-x-100 object-cover" />
      {/* Three equal columns, so "Selfie" sits in the middle of the screen whatever Back's width (a spacer of a guessed
          width beside it left the title 13 px right of centre). */}
      <div className="safe-pt-12 relative grid w-full grid-cols-3 items-center px-5">
        <span className="justify-self-start"><Button variant="text" icon="chevronLeft" onClick={onBack}>{t('ui.selfie.back')}</Button></span>
        <span className="justify-self-center font-text text-16 font-medium">{t('ui.selfie.title')}</span>
      </div>
      <div aria-hidden="true" data-oval={isGood ? 'good' : 'far'}
        className={cx('relative mt-16 h-oval-height w-oval-width rounded-full border-3 outline-999 outline-scrim transition-colors', isGood ? 'border-gold' : 'border-muted')} />
      <GuidanceLine guidance={guidance} />
      <ul className="relative mt-3 flex flex-wrap justify-center gap-2 px-6">
        {TIPS.map((tip) => (
          <li key={tip} className="rounded-full border border-cream-faint px-3 py-1 font-text text-13 text-content">{t(`ui.selfie.${tip}`)}</li>
        ))}
      </ul>
      <button type="button" aria-label={t('ui.camera.take')} disabled={!isLive} onClick={onTake}
        className="absolute bottom-12 size-shutter rounded-full border-3 border-cream p-1 disabled:opacity-disabled">
        <span className="block size-full rounded-full bg-cream" />
      </button>
    </div>
  );
}

interface ReviewProps {
  photo: Blob;
  isSending: boolean;
  error: string | undefined;
  onUse: () => void;
  onRetake: () => void;
}

/** "Use this photo?": the selfie in its 3:4 frame, why it was refused if it was, then Retake and Use photo. */
function Review({ photo, isSending, error, onUse, onRetake }: ReviewProps) {
  const [url] = useState(() => URL.createObjectURL(photo));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="safe-pt-4 mx-auto flex min-h-dvh w-full max-w-phone flex-col gap-5 px-5 pb-10">
      <Heading level={1} variant="serif" serifSize={32}>{t('ui.selfie.reviewTitle')}</Heading>
      <div className="aspect-portrait w-full overflow-hidden rounded-lg border border-hairline bg-raised">
        <img src={url} alt={t('ui.camera.review')} className="size-full object-cover" />
      </div>
      {error ? <ErrorMessage look="dot">{error}</ErrorMessage> : null}
      <div className="mt-auto grid grid-cols-3 gap-2">
        <Button variant="outline" size="tall" fullWidth isDisabled={isSending} onClick={onRetake}>{t('ui.camera.retake')}</Button>
        <span className="col-span-2 flex">
          <Button variant="primary" size="tall" fullWidth isLoading={isSending} onClick={onUse}>{t('ui.camera.use')}</Button>
        </span>
      </div>
    </div>
  );
}

/**
 * The redesign's selfie (decision 0320): the live camera with its oval and guidance, then the photo to use or retake. A
 * blocked or missing camera says what to do, as CameraCapture does, with a QR code to carry on with a phone.
 */
export function SelfieCamera({ onPhoto, isSending = false, error, onBack, phoneUrl }: SelfieCameraProps) {
  // Full screen, with no step around it: it names the page itself (WCAG 2.4.2).
  usePageTitle(t('ui.selfie.title'));
  const [taken, setTaken] = useState<{ photo: Blob; count: number } | null>(null);
  const camera = useCamera('user', taken === null);
  const isTaking = useRef(false);
  const take = async () => {
    if (isTaking.current || camera.video.current === null) return;
    isTaking.current = true;
    const photo = await photoOf(camera.video.current, true).catch(() => null);
    isTaking.current = false;
    if (photo) setTaken((last) => ({ photo, count: (last?.count ?? 0) + 1 }));
  };
  if (taken) {
    return <Review key={taken.count} photo={taken.photo} isSending={isSending} error={error} onUse={() => onPhoto(taken.photo)}
      onRetake={() => { setTaken(null); camera.retry(); }} />;
  }
  if (camera.trouble) {
    return <div className="mx-auto w-full max-w-phone px-5 pt-16"><Trouble trouble={camera.trouble} phoneUrl={phoneUrl} onRetry={camera.retry} /></div>;
  }
  return <Live video={camera.video} isLive={camera.isLive} onTake={() => void take()} onBack={onBack} />;
}

