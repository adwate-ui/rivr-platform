import { useVenueLogoUpload, type VenueLogoFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { CameraButton, ErrorMessage, Inline, Stack, Text, VenueLogo, StatusMessage } from '@rivr/ui';
import { useState } from 'react';

const FAILURE: Readonly<Record<VenueLogoFailure, MessageKey>> = {
  wrong_type: 'console.settings.logoFailed.wrong_type', too_big: 'console.settings.logoFailed.too_big',
  not_allowed: 'console.settings.logoFailed.not_allowed', unavailable: 'console.settings.logoFailed.unavailable',
};

/** The venue's logo on Settings (#397): the one in use, and a super admin uploads a new one, a PNG of up to 1 MB. */
export function LogoField({ venueId, logoUrl }: { venueId: string; logoUrl: string | null }) {
  const uploadLogo = useVenueLogoUpload(venueId);
  const [outcome, setOutcome] = useState<VenueLogoFailure | 'saved' | null>(null);
  const upload = async (logo: File) => {
    setOutcome(null);
    const done = await uploadLogo.mutateAsync(logo);
    setOutcome(done.ok ? 'saved' : done.error);
  };
  return (
    <Stack gap={3}>
      <Text variant="label">{t('console.settings.logo')}</Text>
      <VenueLogo alt={t('console.settings.logoAlt')} src={logoUrl} />
      <Text variant="small" tone="muted">{t('console.settings.logoHint')}</Text>
      <Inline gap={4}>
        <CameraButton variant="secondary" camera="none" accept="image/png" isLoading={uploadLogo.isPending}
          onPhoto={(logo) => void upload(logo)}>
          {logoUrl === null ? t('console.settings.uploadLogo') : t('console.settings.replaceLogo')}
        </CameraButton>
        <StatusMessage>{outcome === 'saved' ? t('console.settings.logoSaved') : null}</StatusMessage>
      </Inline>
      {outcome !== null && outcome !== 'saved' ? <ErrorMessage>{t(FAILURE[outcome])}</ErrorMessage> : null}
    </Stack>
  );
}
