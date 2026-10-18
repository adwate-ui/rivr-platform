import { shrinkPhoto, useKycActions, type KycFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { CameraButton, StepScreen, Text } from '@rivr/ui';
import { useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';

/**
 * The first step of the identity check: a selfie. The vendor checks it is a live person, and it is
 * kept as the KYC photo the cage sees. Once it is in, the record moves the screen on to DigiLocker.
 */
export function SelfieStep() {
  const { sendSelfie } = useKycActions();
  const [failure, setFailure] = useState<KycFailure | null>(null);

  const send = async (photo: File) => {
    setFailure(null);
    // A file the browser cannot read as an image gets the same advice as a selfie that failed.
    const jpeg = await shrinkPhoto(photo).catch(() => null);
    const sent = jpeg ? await sendSelfie.mutateAsync(jpeg) : null;
    if (!sent?.ok) setFailure(sent ? sent.error : 'not_live');
  };
  return (
    <StepScreen
      title={t('player.kyc.title')}
      footer={
        <CameraButton variant="primary" fullWidth isLoading={sendSelfie.isPending} onPhoto={(photo) => void send(photo)}>
          {t('player.kyc.takeSelfie')}
        </CameraButton>
      }
    >
      <Text>{t('player.kyc.intro')}</Text>
      <Text>{t('player.kyc.selfieIntro')}</Text>
      {failure ? <Text>{t(FAILURE_COPY[failure])}</Text> : null}
    </StepScreen>
  );
}
