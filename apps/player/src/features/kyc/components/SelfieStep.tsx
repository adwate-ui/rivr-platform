import { shrinkPhoto, useKycActions, useReportFailure, type KycFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { inAppBrowserOf, OpenInBrowser, SelfieCamera } from '@rivr/ui';
import { useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';

interface SelfieStepProps {
  onBack: () => void;
  onSent: () => void;
  /** For the club (decision 0502): kept as the sign-up photo with no vendor call, and the desk checks the rest. */
  isForTheClub?: boolean;
}

/**
 * The first step of the identity check (decision 0320): a selfie, taken there and then with the device's front camera and
 * never a file (K-07), full-bleed with its oval and live guidance; it takes itself once a face holds still in the oval,
 * where the browser can see faces. The vendor checks it is a live person, and it is kept as the KYC photo. Once it is in,
 * the record moves the screen on to DigiLocker (`onSent`). For the club, it lets the member in to be checked at the desk.
 * What goes wrong with the camera or the photo is reported by its kind (#928): the step is where sign-ups stopped.
 * Instagram's and Facebook's own browsers refuse the camera with no setting to allow it, so there the step sends the
 * member to Safari or Chrome instead (#1050); Continue here tries the camera again.
 */
export function SelfieStep({ onBack, onSent, isForTheClub = false }: SelfieStepProps) {
  const { sendSelfie, sendClubSelfie } = useKycActions();
  const reportFailure = useReportFailure();
  const [failure, setFailure] = useState<KycFailure | null>(null);
  const [inAppBrowser] = useState(() => inAppBrowserOf(navigator.userAgent));
  const [isRefusedHere, setRefusedHere] = useState(false);
  const stepUrl = `${window.location.origin}/kyc`;
  // Busy from the tap, while the photo is made small, not only once it is sent: a second tap would send it twice.
  const [isSending, setIsSending] = useState(false);

  const send = async (photo: Blob) => {
    if (isSending) return;
    setIsSending(true);
    setFailure(null);
    try {
      // A photo the browser cannot read gets the same advice as a selfie that failed.
      const jpeg = await shrinkPhoto(photo).catch(() => {
        reportFailure('selfie:unreadable');
        return null;
      });
      const sent = jpeg ? await (isForTheClub ? sendClubSelfie : sendSelfie).mutateAsync(jpeg) : null;
      // For the club, false is the switch gone off meanwhile: the screen goes back to the app's own check.
      if (sent?.ok && sent.value !== false) onSent();
      else if (!sent?.ok) setFailure(sent ? sent.error : 'not_live');
    } finally {
      setIsSending(false);
    }
  };
  if (isRefusedHere && inAppBrowser) {
    return <OpenInBrowser browser={inAppBrowser} url={stepUrl} why={t(`player.kyc.cameraInAppBrowser.${inAppBrowser.app}`)} onContinue={() => setRefusedHere(false)} />;
  }
  const onTrouble = (trouble: string) => {
    reportFailure(`camera:${trouble}`);
    if (trouble === 'blocked' && inAppBrowser) setRefusedHere(true);
  };
  return (
    <SelfieCamera isSending={isSending} phoneUrl={stepUrl} onBack={onBack} onPhoto={(photo) => void send(photo)}
      error={failure ? t(FAILURE_COPY[failure]) : undefined} onTrouble={onTrouble} />
  );
}
