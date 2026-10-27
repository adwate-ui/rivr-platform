import { t } from '@rivr/i18n';
import { Button, cardToPng, ErrorMessage, ReferralCard, referralCardSvg, saveFile, Stack } from '@rivr/ui';
import { useEffect, useState } from 'react';

/**
 * The member's referral card (#153) with their code, shared with their link through the phone's share sheet; where the
 * browser cannot share a file, it is saved instead. The PNG is drawn when the card shows, so the tap that shares is
 * still fresh when the share sheet opens: some phones refuse a share that waited.
 */
export function ShareReferralCard({ code, link }: { code: string; link: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [failed, setFailed] = useState(false);
  const text = {
    brand: t('memberRewards.referral.card.brand'), heading: t('memberRewards.referral.card.heading'),
    codeLabel: t('memberRewards.referral.card.codeLabel'), code, footer: t('memberRewards.referral.card.footer'),
  };
  const svg = referralCardSvg(text);
  useEffect(() => {
    let isShown = true;
    cardToPng(svg).then(
      (png) => { if (isShown) setFile(new File([png], `rivr-referral-${code}.png`, { type: 'image/png' })); },
      () => { if (isShown) setFailed(true); },
    );
    return () => { isShown = false; };
  }, [svg, code]);
  const share = async (png: File) => {
    setIsSharing(true);
    setFailed(false);
    try {
      if (navigator.canShare?.({ files: [png] })) await navigator.share({ files: [png], text: t('memberRewards.referral.card.message'), url: link });
      else saveFile(png, png.name);
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
      <Button variant="secondary" isLoading={(file === null && !failed) || isSharing} onClick={() => { if (file) void share(file); }}>
        {t('memberRewards.referral.card.share')}
      </Button>
      {failed ? <ErrorMessage>{t('memberRewards.referral.card.failed')}</ErrorMessage> : null}
    </Stack>
  );
}
