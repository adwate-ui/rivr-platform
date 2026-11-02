import { shrinkPhoto, useKycActions, type KycFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { CameraCapture, ErrorMessage, StepScreen } from '@rivr/ui';
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

  const send = async (photo: Blob) => {
    setFailure(null);
    // A photo the browser cannot read gets the same advice as a selfie that failed.
    const jpeg = await shrinkPhoto(photo).catch(() => null);
    const sent = jpeg ? await sendSelfie.mutateAsync(jpeg) : null;
    if (!sent?.ok) setFailure(sent ? sent.error : 'not_live');
  };
  return (
    <StepScreen title={t('player.kyc.selfieTitle')} back={sendSelfie.isPending ? undefined : { label: t('player.kyc.back'), onBack }} footer={null}>
      {/* Above the camera, so on a phone it is in view, not under the frame and its buttons. */}
      {failure ? <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage> : null}
      <CameraCapture hasFaceGuide isSending={sendSelfie.isPending} phoneUrl={`${window.location.origin}/kyc`} onPhoto={(photo) => void send(photo)} />
    </StepScreen>
  );
}
