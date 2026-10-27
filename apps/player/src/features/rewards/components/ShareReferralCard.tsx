import { t } from '@rivr/i18n';
import { Button, cardToPng, ErrorMessage, ReferralCard, referralCardSvg, saveFile, Stack } from '@rivr/ui';
import { useState } from 'react';

/**
 * The member's referral card (#153), drawn on demand with their code and shared through the phone's share sheet;
 * where the browser cannot share a file, it is saved instead.
 */
export function ShareReferralCard({ code }: { code: string }) {
  const [isSharing, setIsSharing] = useState(false);
  const [failed, setFailed] = useState(false);
  const text = {
    heading: t('memberRewards.referral.card.heading'), codeLabel: t('memberRewards.referral.card.codeLabel'), code,
    footer: t('memberRewards.referral.card.footer'),
  };
  const share = async () => {
    setIsSharing(true);
    setFailed(false);
    try {
      const file = new File([await cardToPng(referralCardSvg(text))], `rivr-referral-${code}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: t('memberRewards.referral.card.message', { code }) });
      else saveFile(file, file.name);
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true);
    } finally {
      setIsSharing(false);
    }
  };
  return (
    <Stack gap={3}>
      <ReferralCard text={text} alt={t('memberRewards.referral.card.alt', { code })} />
      <Button variant="primary" isLoading={isSharing} onClick={() => void share()}>{t('memberRewards.referral.card.share')}</Button>
      {failed ? <ErrorMessage>{t('memberRewards.referral.card.failed')}</ErrorMessage> : null}
    </Stack>
  );
}
