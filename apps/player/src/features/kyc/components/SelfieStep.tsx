import { shrinkPhoto, useKycActions, type KycFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { CameraCapture, StepScreen } from '@rivr/ui';
import { useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';

/**
 * The first step of the identity check: a selfie, taken there and then with the device's camera, on a phone or a
 * computer, and never a file (K-07). The vendor checks it is a live person, and it is kept as the KYC photo the cage
 * sees. Once it is in, the record moves the screen on to DigiLocker. A device with no camera offers a QR code to carry
 * on with a phone.
 */
export function SelfieStep({ onBack }: { onBack: () => void }) {
  const { sendSelfie } = useKycActions();
  const [failure, setFailure] = useState<KycFailure | null>(null);
  // Busy from the tap, while the photo is made small, not only once it is sent: a second tap would send it twice.
  const [isSending, setIsSending] = useState(false);

  const send = async (photo: Blob) => {
    if (isSending) return;
    setIsSending(true);
    setFailure(null);
    try {
      // A photo the browser cannot read gets the same advice as a selfie that failed.
      const jpeg = await shrinkPhoto(photo).catch(() => null);
      const sent = jpeg ? await sendSelfie.mutateAsync(jpeg) : null;
      if (!sent?.ok) setFailure(sent ? sent.error : 'not_live');
    } finally {
      setIsSending(false);
    }
  };
  return (
    <StepScreen title={t('player.kyc.selfieTitle')} back={isSending ? undefined : { label: t('common.back'), onBack }} footer={null}>
      {/* The refusal shows under the photo, between it and Use photo, so a phone has it in view. */}
      <CameraCapture hasFaceGuide isSending={isSending} phoneUrl={`${window.location.origin}/kyc`} onPhoto={(photo) => void send(photo)}
        error={failure ? t(FAILURE_COPY[failure]) : undefined} />
    </StepScreen>
  );
}
